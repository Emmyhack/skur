import { useAccount } from "wagmi";
import { decodeAbiParameters, stringToHex } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { useTx } from "../hooks/useTx";
import type { ProposalView, VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDate, fmtRelative, nowSec, short } from "../lib/format";
import {
  explainReasons,
  Kind,
  KIND_LABEL,
  Mode,
  MODE_LABEL,
  ROLE_APPROVER,
  ROLE_EXECUTOR,
  ROLE_GUARDIAN,
  ROLE_OWNER,
  roleNames,
  Status,
  Trust,
  TRUST_LABEL,
} from "../lib/types";
import { Address, Badge, Button, StatusBadge, TierBadge, TxStatus } from "./ui";

function describe(p: ProposalView, vault: VaultData): { title: string; lines: Array<[string, string]> } {
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  switch (p.kind) {
    case Kind.TRANSFER: {
      const amt = asset ? fmtAmount(p.amount, asset.decimals, asset.symbol) : String(p.amount);
      return { title: `Send ${amt} to ${short(p.target)}`, lines: [] };
    }
    case Kind.POLICY_UPDATE:
      return { title: "Update vault policy", lines: [["Effect", p.securityReducing ? "Loosens at least one control" : "Tightens or keeps every control"]] };
    case Kind.ASSET_LIMITS:
      return { title: `Change limits for ${asset?.symbol ?? short(p.target)}`, lines: [["Effect", p.securityReducing ? "Loosens a limit or approves an asset" : "Tightens limits"]] };
    case Kind.MEMBER_SET: {
      const roles = Number(p.amount);
      return {
        title: roles === 0 ? `Remove member ${short(p.target)}` : `Set ${short(p.target)} to ${roleNames(roles).join(" + ")}`,
        lines: [["Effect", p.securityReducing ? "Adds authority or weakens guardians" : "Reduces authority"]],
      };
    }
    case Kind.RECIPIENT_TRUST:
      return { title: `Mark ${short(p.target)} as ${TRUST_LABEL[Number(p.amount) as Trust]}`, lines: [] };
    case Kind.MODE_RELAX:
      return { title: `Lower security mode to ${MODE_LABEL[Number(p.amount) as Mode]}`, lines: [["Effect", "Security-reducing; guardians must confirm"]] };
    case Kind.RECOVERY: {
      let newSigner = "?";
      try {
        newSigner = decodeAbiParameters([{ type: "address" }], p.data)[0];
      } catch {
        /* ignore */
      }
      return { title: `Replace signer ${short(p.target)} with ${short(newSigner)}`, lines: [["Effect", "Same roles; vault moves to Elevated when complete"]] };
    }
  }
}

export function ProposalCard({ p, vault, onChanged }: { p: ProposalView; vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const tx = useTx(onChanged);
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const now = nowSec();
  const { title, lines } = describe(p, vault);
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  const pending = p.status === Status.PENDING;
  const expired = pending && Number(p.expiresAt) < now;
  const timelocked = Number(p.executableAfter) > now;
  const alreadyApproved = address ? [...p.approvers, ...p.guardianConfirmers].some((a) => a.toLowerCase() === address.toLowerCase()) : false;

  const canApprove =
    pending && !expired && !alreadyApproved &&
    (roles & ROLE_GUARDIAN
      ? p.requiredGuardians > 0
      : p.kind === Kind.RECOVERY
        ? false
        : p.kind === Kind.TRANSFER
          ? Boolean(roles & ROLE_APPROVER)
          : Boolean(roles & ROLE_OWNER));
  const executeRole = p.kind === Kind.TRANSFER ? ROLE_EXECUTOR : p.kind === Kind.RECOVERY ? ROLE_OWNER | ROLE_GUARDIAN : ROLE_OWNER | ROLE_EXECUTOR;
  const approvalsMet = p.liveApprovals >= p.requiredApprovals && p.liveGuardians >= p.requiredGuardians;
  const canExecute = pending && !expired && Boolean(roles & executeRole) && approvalsMet && !timelocked;
  const canVeto = pending && !expired && Boolean(roles & ROLE_GUARDIAN) && p.vetoable;
  const canCancel = pending && !expired && (Boolean(roles & ROLE_OWNER) || p.proposer.toLowerCase() === address?.toLowerCase());
  const lockedOut = vault.mode === Mode.LOCKDOWN && (p.kind === Kind.TRANSFER || (p.securityReducing && p.kind !== Kind.MODE_RELAX));

  const call = (functionName: string, args: readonly unknown[] = [p.id]) =>
    tx.send({ address: vault.address, abi: SkurVaultAbi, functionName, args });

  const exposure = asset && p.kind === Kind.TRANSFER && asset.balance > 0n ? Number((p.amount * 10_000n) / (asset.balance + p.amount)) : null;
  const reasons = explainReasons(p.riskReasons);

  return (
    <article className="proposal">
      <div className="proposal-head">
        <div className="inline">
          <span className="muted">#{String(p.id)}</span>
          <span className="proposal-title">{title}</span>
        </div>
        <div className="inline">
          {p.kind === Kind.TRANSFER && <TierBadge tier={p.tier} />}
          {p.securityReducing && <Badge tone="warn">Security-reducing</Badge>}
          <Badge tone="neutral">{KIND_LABEL[p.kind]}</Badge>
          <StatusBadge status={expired ? Status.CANCELLED : p.status} />
          {expired && <Badge tone="neutral">Expired</Badge>}
        </div>
      </div>
      {p.memo && <p className="muted" style={{ marginTop: 4 }}>“{p.memo}”</p>}
      <div className="proposal-body">
        <div>
          <div className="muted small">Approvals</div>
          <div>
            {p.liveApprovals} / {p.requiredApprovals}
            {p.requiredGuardians > 0 && <> · guardians {p.liveGuardians} / {p.requiredGuardians}</>}
          </div>
        </div>
        <div>
          <div className="muted small">Executable</div>
          <div>{timelocked ? `${fmtRelative(p.executableAfter)} (${fmtDate(p.executableAfter)})` : pending ? "now" : "—"}</div>
        </div>
        <div>
          <div className="muted small">Proposed by</div>
          <Address value={p.proposer} />
        </div>
        <div>
          <div className="muted small">Expires</div>
          <div>{fmtDate(p.expiresAt)}</div>
        </div>
        {p.kind === Kind.TRANSFER && exposure !== null && (
          <div>
            <div className="muted small">Treasury impact</div>
            <div>{fmtBps(exposure)} of {asset?.symbol} at execution-time balance</div>
          </div>
        )}
        {lines.map(([k, v]) => (
          <div key={k}>
            <div className="muted small">{k}</div>
            <div>{v}</div>
          </div>
        ))}
        {p.vetoable && pending && (
          <div>
            <div className="muted small">Guardian veto</div>
            <div>Open until execution</div>
          </div>
        )}
      </div>
      {reasons.length > 0 && p.kind === Kind.TRANSFER && (
        <ul className="reasons small">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {p.approvers.length + p.guardianConfirmers.length > 0 && (
        <div className="small muted" style={{ marginTop: 8 }}>
          Approved by {p.approvers.map((a) => short(a)).join(", ") || "—"}
          {p.guardianConfirmers.length > 0 && <> · confirmed by {p.guardianConfirmers.map((a) => short(a)).join(", ")}</>}
        </div>
      )}
      {pending && (
        <div className="proposal-foot">
          {canApprove && (
            <Button onClick={() => call("approve")} disabled={tx.busy}>
              {roles & ROLE_GUARDIAN ? "Confirm as guardian" : "Approve"}
            </Button>
          )}
          {Boolean(roles & executeRole) && !expired && (
            <Button kind="primary" onClick={() => call("execute")} disabled={!canExecute || tx.busy || lockedOut} title={lockedOut ? "Vault is in Lockdown" : timelocked ? "Timelocked" : !approvalsMet ? "Approvals not met" : undefined}>
              Execute
            </Button>
          )}
          {canVeto && (
            <Button kind="danger" onClick={() => call("veto", [p.id, stringToHex("vetoed", { size: 32 })])} disabled={tx.busy}>
              Veto
            </Button>
          )}
          {canCancel && (
            <Button kind="secondary" onClick={() => call("cancel")} disabled={tx.busy}>
              Cancel
            </Button>
          )}
          {expired && (
            <Button kind="secondary" onClick={() => call("expire")} disabled={tx.busy}>
              Mark expired
            </Button>
          )}
        </div>
      )}
      <TxStatus state={tx.state} />
    </article>
  );
}
