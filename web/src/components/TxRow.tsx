import { useState } from "react";
import { useAccount } from "wagmi";
import { decodeAbiParameters, stringToHex } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { useTx } from "../hooks/useTx";
import type { ProposalView, VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDate, fmtRelative, nowSec, short } from "../lib/format";
import { explainReasons, Kind, KIND_LABEL, Mode, MODE_LABEL, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, roleNames, Status, Trust, TRUST_LABEL } from "../lib/types";
import { Address, Badge, Button, ConfirmPill, TierBadge, TokenIcon, TxStatus } from "./ui";
import { IconChevron, IconLock, IconPolicy, IconSend, IconShield, IconUsers } from "./icons";

function describe(p: ProposalView, vault: VaultData): { kind: string; amount?: string; symbol?: string; detail: string } {
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  switch (p.kind) {
    case Kind.TRANSFER:
      return { kind: "Send", amount: asset ? `-${fmtAmount(p.amount, asset.decimals)} ${asset.symbol}` : String(p.amount), symbol: asset?.symbol, detail: `to ${short(p.target)}` };
    case Kind.POLICY_UPDATE:
      return { kind: "Policy update", detail: p.securityReducing ? "loosens at least one control" : "tightens or keeps every control" };
    case Kind.ASSET_LIMITS:
      return { kind: "Asset limits", detail: `${asset?.symbol ?? short(p.target)} · ${p.securityReducing ? "loosens a limit or approves an asset" : "tightens limits"}` };
    case Kind.MEMBER_SET: {
      const roles = Number(p.amount);
      return { kind: roles === 0 ? "Remove member" : "Set roles", detail: `${short(p.target)}${roles ? ` → ${roleNames(roles).join(" + ")}` : ""}` };
    }
    case Kind.RECIPIENT_TRUST:
      return { kind: "Recipient trust", detail: `${short(p.target)} → ${TRUST_LABEL[Number(p.amount) as Trust]}` };
    case Kind.MODE_RELAX:
      return { kind: "Lower security mode", detail: `to ${MODE_LABEL[Number(p.amount) as Mode]} · guardians must confirm` };
    case Kind.RECOVERY: {
      let newSigner = "?";
      try {
        newSigner = decodeAbiParameters([{ type: "address" }], p.data)[0];
      } catch {
        /* ignore */
      }
      return { kind: "Recovery", detail: `${short(p.target)} → ${short(newSigner)}` };
    }
  }
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === Kind.TRANSFER) return <IconSend width={18} height={18} style={{ color: "var(--error)" }} />;
  if (kind === Kind.RECOVERY || kind === Kind.MODE_RELAX) return <IconShield width={18} height={18} style={{ color: "var(--warning)" }} />;
  if (kind === Kind.MEMBER_SET) return <IconUsers width={18} height={18} style={{ color: "var(--info)" }} />;
  return <IconPolicy width={18} height={18} style={{ color: "var(--info)" }} />;
}

/** One transaction as Safe renders it: a rounded card row (type, amount, time, status) that expands into details and a timeline. */
export function TxRow({ p, vault, onChanged, compact = false }: { p: ProposalView; vault: VaultData; onChanged: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { address } = useAccount();
  const tx = useTx(onChanged);
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const now = nowSec();
  const d = describe(p, vault);
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  const pending = p.status === Status.PENDING;
  const expired = pending && Number(p.expiresAt) < now;
  const timelocked = Number(p.executableAfter) > now;
  const alreadyApproved = address ? [...p.approvers, ...p.guardianConfirmers].some((a) => a.toLowerCase() === address.toLowerCase()) : false;

  const canApprove = pending && !expired && !alreadyApproved && (roles & ROLE_GUARDIAN ? p.requiredGuardians > 0 : p.kind === Kind.RECOVERY ? false : p.kind === Kind.TRANSFER ? Boolean(roles & ROLE_APPROVER) : Boolean(roles & ROLE_OWNER));
  const executeRole = p.kind === Kind.TRANSFER ? ROLE_EXECUTOR : p.kind === Kind.RECOVERY ? ROLE_OWNER | ROLE_GUARDIAN : ROLE_OWNER | ROLE_EXECUTOR;
  const approvalsMet = p.liveApprovals >= p.requiredApprovals && p.liveGuardians >= p.requiredGuardians;
  const lockedOut = vault.mode === Mode.LOCKDOWN && (p.kind === Kind.TRANSFER || (p.securityReducing && p.kind !== Kind.MODE_RELAX));
  const canExecute = pending && !expired && Boolean(roles & executeRole) && approvalsMet && !timelocked && !lockedOut;
  const canVeto = pending && !expired && Boolean(roles & ROLE_GUARDIAN) && p.vetoable;
  const canCancel = pending && !expired && (Boolean(roles & ROLE_OWNER) || p.proposer.toLowerCase() === address?.toLowerCase());
  const call = (functionName: string, args: readonly unknown[] = [p.id]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName, args });
  const reasons = explainReasons(p.riskReasons);
  const need = p.requiredApprovals + p.requiredGuardians;
  const have = Math.min(p.liveApprovals, p.requiredApprovals) + Math.min(p.liveGuardians, p.requiredGuardians);
  const stage: "confirm" | "wait" | "execute" | "final" = !pending ? "final" : !approvalsMet ? "confirm" : timelocked || lockedOut ? "wait" : "execute";

  const status = pending && !expired ? (
    <ConfirmPill have={have} need={need} />
  ) : (
    <span className={p.status === Status.EXECUTED ? "status-success" : p.status === Status.VETOED ? "status-veto" : "status-cancel"}>
      {p.status === Status.EXECUTED ? "Success" : p.status === Status.VETOED ? "Vetoed" : expired ? "Expired" : "Cancelled"}
    </span>
  );

  return (
    <div className="txcard">
      <div className="row" onClick={() => setOpen((o) => !o)} style={compact ? { gridTemplateColumns: "24px 1fr auto 24px", padding: "14px 12px" } : undefined}>
        <KindIcon kind={p.kind} />
        <div className="kind truncate">
          {d.kind}
          {compact && d.amount && <span className="muted"> · {d.amount}</span>}
          {compact && <div className="caption truncate">{d.detail}</div>}
        </div>
        {!compact && (
          <div className="amt hide-sm">
            {d.symbol && <TokenIcon symbol={d.symbol} size={24} />}
            <span className="truncate">{d.amount ?? d.detail}</span>
            {d.amount && <span className="caption truncate">{d.detail}</span>}
          </div>
        )}
        {!compact && <div className="when hide-sm">{fmtDate(p.createdAt).split(",").slice(-1)[0]?.trim() || fmtRelative(p.createdAt)}</div>}
        <div className="status">{status}</div>
        <IconChevron className={`chev ${open ? "open" : ""}`} />
      </div>

      {open && (
        <div className="detail" style={compact ? { gridTemplateColumns: "1fr", paddingLeft: 12, paddingRight: 12 } : undefined}>
          <div>
            <div className="inline" style={{ marginBottom: 12 }}>
              <Badge tone="neutral">{KIND_LABEL[p.kind]} #{String(p.id)}</Badge>
              {p.kind === Kind.TRANSFER && <TierBadge tier={p.tier} />}
              {p.securityReducing && <Badge tone="warn">Security-reducing</Badge>}
              {pending && !expired && (
                <Badge tone={stage === "execute" ? "brand" : stage === "wait" ? "review" : "neutral"}>
                  {stage === "execute" ? "Ready to execute" : stage === "wait" ? (lockedOut ? "Locked down" : `Executable ${fmtRelative(p.executableAfter)}`) : "Needs confirmations"}
                </Badge>
              )}
            </div>
            <dl className="kv">
              {p.kind === Kind.TRANSFER && (
                <>
                  <div><dt>Recipient</dt><dd><Address value={p.target} copy /></dd></div>
                  <div><dt>Amount</dt><dd className="num">{asset ? fmtAmount(p.amount, asset.decimals, asset.symbol) : String(p.amount)}</dd></div>
                  {asset && asset.balance > 0n && <div><dt>Treasury impact</dt><dd>{fmtBps(Number((p.amount * 10_000n) / (asset.balance + (p.status === Status.EXECUTED ? p.amount : 0n))))} of {asset.symbol}</dd></div>}
                </>
              )}
              {p.kind !== Kind.TRANSFER && p.target !== "0x0000000000000000000000000000000000000000" && <div><dt>Target</dt><dd><Address value={p.target} copy /></dd></div>}
              {p.memo && <div><dt>Purpose</dt><dd>{p.memo}</dd></div>}
              <div><dt>Proposed by</dt><dd><Address value={p.proposer} /></dd></div>
              <div><dt>Requirement</dt><dd>{p.requiredApprovals} approval{p.requiredApprovals === 1 ? "" : "s"}{p.requiredGuardians ? ` + ${p.requiredGuardians} guardian` : ""}{Number(p.executableAfter) > Number(p.createdAt) ? ` · not before ${fmtDate(p.executableAfter)}` : ""}</dd></div>
              <div><dt>Expires</dt><dd>{fmtDate(p.expiresAt)}</dd></div>
              {p.vetoable && pending && <div><dt>Guardian veto</dt><dd>open until execution</dd></div>}
            </dl>
            {reasons.length > 0 && p.kind === Kind.TRANSFER && (
              <>
                <div className="overline" style={{ marginTop: 16 }}>Why this tier</div>
                <ul className="reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </>
            )}
            {pending && (
              <div className="tx-actions">
                {canApprove && <Button onClick={() => call("approve")} disabled={tx.busy}>{roles & ROLE_GUARDIAN ? "Confirm as guardian" : "Confirm"}</Button>}
                {Boolean(roles & executeRole) && !expired && (
                  <Button kind={canApprove ? "secondary" : "primary"} onClick={() => call("execute")} disabled={!canExecute || tx.busy} title={lockedOut ? "Vault is in Lockdown" : timelocked ? "Timelocked" : !approvalsMet ? "Confirmations not met" : undefined} icon={lockedOut ? <IconLock width={14} height={14} /> : undefined}>Execute</Button>
                )}
                {canVeto && <Button kind="danger" onClick={() => call("veto", [p.id, stringToHex("vetoed", { size: 32 })])} disabled={tx.busy}>Veto</Button>}
                {canCancel && !expired && <Button kind="ghost" onClick={() => call("cancel")} disabled={tx.busy}>Cancel</Button>}
                {expired && <Button kind="ghost" onClick={() => call("expire")} disabled={tx.busy}>Mark expired</Button>}
              </div>
            )}
            <TxStatus state={tx.state} />
          </div>
          <ul className="timeline">
            <li className="done"><div className="t-title">Created</div><div className="t-sub">{fmtDate(p.createdAt)} by {short(p.proposer)}</div></li>
            <li className={p.liveApprovals >= p.requiredApprovals ? "done" : stage === "confirm" ? "active" : ""}>
              <div className="t-title">Confirmations ({Math.min(p.liveApprovals, p.requiredApprovals)} of {p.requiredApprovals})</div>
              <div className="signers">
                {p.approvers.length === 0 && <span className="t-sub">No confirmations yet</span>}
                {p.approvers.map((a) => <span key={a} className="inline"><span className="lime">✓</span> <Address value={a} /></span>)}
              </div>
            </li>
            {p.requiredGuardians > 0 && (
              <li className={p.liveGuardians >= p.requiredGuardians ? "done" : stage === "confirm" ? "active" : ""}>
                <div className="t-title">Guardian confirmations ({Math.min(p.liveGuardians, p.requiredGuardians)} of {p.requiredGuardians})</div>
                <div className="signers">
                  {p.guardianConfirmers.length === 0 && <span className="t-sub">Independent sign-off required</span>}
                  {p.guardianConfirmers.map((a) => <span key={a} className="inline"><span className="lime">✓</span> <Address value={a} /></span>)}
                </div>
              </li>
            )}
            {Number(p.executableAfter) > Number(p.createdAt) && (
              <li className={!timelocked ? "done" : stage === "wait" ? "active" : ""}>
                <div className="t-title">Timelock</div>
                <div className="t-sub">{timelocked ? `Executable ${fmtRelative(p.executableAfter)}` : `Passed ${fmtDate(p.executableAfter)}`}</div>
              </li>
            )}
            <li className={p.status === Status.EXECUTED ? "done" : stage === "execute" ? "active" : ""}>
              <div className="t-title">{p.status === Status.EXECUTED ? "Executed" : p.status === Status.VETOED ? "Vetoed by a guardian" : p.status === Status.CANCELLED ? "Cancelled" : "Execute"}</div>
              <div className="t-sub">{pending ? (stage === "execute" ? "Any executor can execute now" : "Waiting on the steps above") : ""}</div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
