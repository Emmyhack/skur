import { useState } from "react";
import { useAccount } from "wagmi";
import { decodeAbiParameters, stringToHex } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { useTx } from "../hooks/useTx";
import type { ProposalView, VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDate, fmtRelative, nowSec, short } from "../lib/format";
import { explainReasons, Kind, KIND_LABEL, Mode, MODE_LABEL, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, roleNames, Status, Trust, TRUST_LABEL } from "../lib/types";
import { Address, Badge, Button, ConfirmPill, StatusBadge, TierBadge, TxStatus } from "./ui";
import { IconChevron, IconLock, IconPolicy, IconSend, IconShield, IconUsers } from "./icons";

function describe(p: ProposalView, vault: VaultData): { title: string; detail?: string } {
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  switch (p.kind) {
    case Kind.TRANSFER:
      return { title: `Send ${asset ? fmtAmount(p.amount, asset.decimals, asset.symbol) : String(p.amount)}`, detail: `to ${short(p.target)}` };
    case Kind.POLICY_UPDATE:
      return { title: "Update policy", detail: p.securityReducing ? "loosens at least one control" : "tightens or keeps every control" };
    case Kind.ASSET_LIMITS:
      return { title: `Change ${asset?.symbol ?? short(p.target)} limits`, detail: p.securityReducing ? "loosens a limit or approves an asset" : "tightens limits" };
    case Kind.MEMBER_SET: {
      const roles = Number(p.amount);
      return roles === 0 ? { title: `Remove member`, detail: short(p.target) } : { title: `Set ${roleNames(roles).join(" + ")}`, detail: short(p.target) };
    }
    case Kind.RECIPIENT_TRUST:
      return { title: `Mark recipient ${TRUST_LABEL[Number(p.amount) as Trust]}`, detail: short(p.target) };
    case Kind.MODE_RELAX:
      return { title: `Lower security mode to ${MODE_LABEL[Number(p.amount) as Mode]}`, detail: "guardians must confirm" };
    case Kind.RECOVERY: {
      let newSigner = "?";
      try {
        newSigner = decodeAbiParameters([{ type: "address" }], p.data)[0];
      } catch {
        /* ignore */
      }
      return { title: "Replace signer", detail: `${short(p.target)} → ${short(newSigner)}` };
    }
  }
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === Kind.TRANSFER) return <span className="tx-ico out"><IconSend /></span>;
  if (kind === Kind.RECOVERY || kind === Kind.MODE_RELAX) return <span className="tx-ico guard"><IconShield /></span>;
  if (kind === Kind.MEMBER_SET) return <span className="tx-ico gov"><IconUsers /></span>;
  return <span className="tx-ico gov"><IconPolicy /></span>;
}

export function TxRow({ p, vault, onChanged, defaultOpen = false }: { p: ProposalView; vault: VaultData; onChanged: () => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { address } = useAccount();
  const tx = useTx(onChanged);
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const now = nowSec();
  const { title, detail } = describe(p, vault);
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  const pending = p.status === Status.PENDING;
  const expired = pending && Number(p.expiresAt) < now;
  const timelocked = Number(p.executableAfter) > now;
  const alreadyApproved = address ? [...p.approvers, ...p.guardianConfirmers].some((a) => a.toLowerCase() === address.toLowerCase()) : false;

  const canApprove =
    pending && !expired && !alreadyApproved &&
    (roles & ROLE_GUARDIAN ? p.requiredGuardians > 0 : p.kind === Kind.RECOVERY ? false : p.kind === Kind.TRANSFER ? Boolean(roles & ROLE_APPROVER) : Boolean(roles & ROLE_OWNER));
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

  let stage: "confirm" | "wait" | "execute" | "final" = "confirm";
  if (!pending) stage = "final";
  else if (!approvalsMet) stage = "confirm";
  else if (timelocked || lockedOut) stage = "wait";
  else stage = "execute";

  return (
    <div className="tx-row">
      <div className="tx-summary" onClick={() => setOpen((o) => !o)}>
        <KindIcon kind={p.kind} />
        <div className="truncate">
          <div className="strong truncate">{title}</div>
          <div className="caption truncate">{detail}{p.memo ? ` · “${p.memo}”` : ""}</div>
        </div>
        <div className="col-hide">
          <div className="when">#{String(p.id)} · {fmtRelative(p.createdAt)}</div>
          <div className="inline" style={{ gap: 6, marginTop: 2 }}>
            {p.kind === Kind.TRANSFER && <TierBadge tier={p.tier} />}
            {p.securityReducing && <Badge tone="warn">Security-reducing</Badge>}
          </div>
        </div>
        <div>{pending && !expired ? <ConfirmPill have={have} need={need} /> : <StatusBadge status={expired ? Status.CANCELLED : p.status} />}</div>
        <div className="col-hide">
          {pending && !expired && (
            <Badge tone={stage === "execute" ? "brand" : stage === "wait" ? "review" : "neutral"}>
              {stage === "execute" ? "Ready to execute" : stage === "wait" ? (lockedOut ? "Locked down" : `Executable ${fmtRelative(p.executableAfter)}`) : "Needs confirmations"}
            </Badge>
          )}
          {expired && <Badge tone="neutral">Expired</Badge>}
        </div>
        <IconChevron className={`chev ${open ? "open" : ""}`} />
      </div>

      {open && (
        <div className="tx-detail">
          <div>
            <div className="overline" style={{ marginBottom: 8 }}>{KIND_LABEL[p.kind]}</div>
            <dl className="kv">
              {p.kind === Kind.TRANSFER && (
                <>
                  <div><dt>Recipient</dt><dd><Address value={p.target} copy /></dd></div>
                  <div><dt>Amount</dt><dd className="num">{asset ? fmtAmount(p.amount, asset.decimals, asset.symbol) : String(p.amount)}</dd></div>
                  {asset && asset.balance > 0n && (
                    <div><dt>Treasury impact now</dt><dd>{fmtBps(Number((p.amount * 10_000n) / (asset.balance + (p.status === Status.EXECUTED ? p.amount : 0n))))} of {asset.symbol}</dd></div>
                  )}
                </>
              )}
              {p.kind !== Kind.TRANSFER && p.target !== "0x0000000000000000000000000000000000000000" && (
                <div><dt>Target</dt><dd><Address value={p.target} copy /></dd></div>
              )}
              <div><dt>Proposed by</dt><dd><Address value={p.proposer} /></dd></div>
              <div><dt>Requirement</dt><dd>{p.requiredApprovals} approval{p.requiredApprovals === 1 ? "" : "s"}{p.requiredGuardians ? ` + ${p.requiredGuardians} guardian` : ""}{Number(p.executableAfter) > Number(p.createdAt) ? ` · wait until ${fmtDate(p.executableAfter)}` : ""}</dd></div>
              <div><dt>Expires</dt><dd>{fmtDate(p.expiresAt)}</dd></div>
              {p.vetoable && pending && <div><dt>Guardian veto</dt><dd>open until execution</dd></div>}
            </dl>
            {reasons.length > 0 && p.kind === Kind.TRANSFER && (
              <>
                <div className="overline" style={{ marginTop: 16 }}>Why this tier</div>
                <ul className="reasons">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {pending && (
              <div className="tx-actions">
                {canApprove && (
                  <Button onClick={() => call("approve")} disabled={tx.busy}>
                    {roles & ROLE_GUARDIAN ? "Confirm as guardian" : "Confirm"}
                  </Button>
                )}
                {Boolean(roles & executeRole) && !expired && (
                  <Button kind={canApprove ? "secondary" : "primary"} onClick={() => call("execute")} disabled={!canExecute || tx.busy} title={lockedOut ? "Vault is in Lockdown" : timelocked ? "Timelocked" : !approvalsMet ? "Confirmations not met" : undefined} icon={lockedOut ? <IconLock width={14} height={14} /> : undefined}>
                    Execute
                  </Button>
                )}
                {canVeto && (
                  <Button kind="danger" onClick={() => call("veto", [p.id, stringToHex("vetoed", { size: 32 })])} disabled={tx.busy}>
                    Veto
                  </Button>
                )}
                {canCancel && !expired && (
                  <Button kind="ghost" onClick={() => call("cancel")} disabled={tx.busy}>
                    Cancel
                  </Button>
                )}
                {expired && (
                  <Button kind="ghost" onClick={() => call("expire")} disabled={tx.busy}>
                    Mark expired
                  </Button>
                )}
              </div>
            )}
            <TxStatus state={tx.state} />
          </div>

          <ul className="timeline">
            <li className="done">
              <div className="t-title">Created</div>
              <div className="t-sub">{fmtDate(p.createdAt)} by {short(p.proposer)}</div>
            </li>
            <li className={p.liveApprovals >= p.requiredApprovals ? "done" : stage === "confirm" ? "active" : ""}>
              <div className="t-title">Confirmations ({Math.min(p.liveApprovals, p.requiredApprovals)} of {p.requiredApprovals})</div>
              <div className="signers">
                {p.approvers.length === 0 && <span className="t-sub">No confirmations yet</span>}
                {p.approvers.map((a) => (
                  <span key={a} className="inline"><span className="pill pill-ok" style={{ height: 18, padding: "0 6px" }}>✓</span> <Address value={a} /></span>
                ))}
              </div>
            </li>
            {p.requiredGuardians > 0 && (
              <li className={p.liveGuardians >= p.requiredGuardians ? "done" : stage === "confirm" ? "active" : ""}>
                <div className="t-title">Guardian confirmations ({Math.min(p.liveGuardians, p.requiredGuardians)} of {p.requiredGuardians})</div>
                <div className="signers">
                  {p.guardianConfirmers.length === 0 && <span className="t-sub">Independent guardian sign-off required</span>}
                  {p.guardianConfirmers.map((a) => (
                    <span key={a} className="inline"><span className="pill pill-ok" style={{ height: 18, padding: "0 6px" }}>✓</span> <Address value={a} /></span>
                  ))}
                </div>
              </li>
            )}
            {Number(p.executableAfter) > Number(p.createdAt) && (
              <li className={!timelocked ? "done" : stage === "wait" ? "active" : ""}>
                <div className="t-title">Timelock</div>
                <div className="t-sub">{timelocked ? `Executable ${fmtRelative(p.executableAfter)} (${fmtDate(p.executableAfter)})` : `Passed ${fmtDate(p.executableAfter)}`}</div>
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
