import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Badge, Button, CopyButton, Field, Modal, Section, TxStatus } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { IconPlus } from "../components/icons";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtDuration } from "../lib/format";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, roleNames } from "../lib/types";

/** Mirrors Safe's Settings › Setup: "Members" and "Required confirmations" as label/content sections. */
export function Members({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const isOwner = Boolean((me?.roles ?? 0) & ROLE_OWNER);
  const tx = useTx(() => { onChanged(); setDialog(false); });
  const [dialog, setDialog] = useState(false);
  const [target, setTarget] = useState("");
  const [bits, setBits] = useState(ROLE_APPROVER);
  const signers = vault.members.filter((m) => !(m.roles & ROLE_GUARDIAN));
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);
  const existing = vault.members.find((m) => m.address.toLowerCase() === target.toLowerCase());
  const adds = existing ? bits & ~existing.roles : bits;
  const reducing = adds !== 0 || Boolean(existing && existing.roles & ROLE_GUARDIAN && !(bits & ROLE_GUARDIAN));
  const toggle = (b: number) => setBits((x) => (b === ROLE_GUARDIAN ? (x & ROLE_GUARDIAN ? 0 : ROLE_GUARDIAN) : ((x & b ? x & ~b : x | b) & ~ROLE_GUARDIAN)));
  const edit = (addr: string, roles: number) => { setTarget(addr); setBits(roles); setDialog(true); };

  const Row = ({ m }: { m: { address: `0x${string}`; roles: number } }) => (
    <div className="member-row">
      <Identicon address={m.address} size={36} />
      <a className="addr" href={`https://explorer.34.60.137.196.sslip.io/address/${m.address}`} target="_blank" rel="noreferrer" title="View on explorer"><b>ark:</b>{m.address}</a>
      <CopyButton value={m.address} />
      <span className="roles">{roleNames(m.roles).map((r) => <Badge key={r} tone={r === "Guardian" ? "warn" : r === "Owner" ? "brand" : "neutral"}>{r}</Badge>)}</span>
      <span className="tools">
        <Button size="sm" kind="ghost" onClick={() => edit(m.address, m.roles)} disabled={!isOwner}>Edit</Button>
        <Button size="sm" kind="ghost" onClick={() => edit(m.address, 0)} disabled={!isOwner}>Remove</Button>
      </span>
    </div>
  );

  return (
    <>
      <Section title="Members">
        <h4>Signers</h4>
        <p className="desc">Owners run governance, approvers confirm payments, executors execute once every condition holds. A member can hold several of these.</p>
        <div className="inline" style={{ marginBottom: 12 }}>
          <Button kind="secondary" size="sm" onClick={() => { setTarget(""); setBits(ROLE_APPROVER); setDialog(true); }} disabled={!isOwner} icon={<IconPlus width={14} height={14} />}>Add member</Button>
        </div>
        {signers.map((m) => <Row key={m.address} m={m} />)}

        <h4 style={{ marginTop: 32 }}>Guardians</h4>
        <p className="desc">Guardians can freeze the vault, veto risky or security-reducing proposals, confirm critical transfers and start recovery. They can never hold a treasury role or move funds.</p>
        {guardians.length === 0 ? <div className="notice notice-bad">No guardian configured. Nobody independent can veto or freeze.</div> : guardians.map((m) => <Row key={m.address} m={m} />)}
      </Section>

      <Section title="Required confirmations">
        <p className="desc" style={{ marginBottom: 8 }}>A routine transfer requires the confirmation of:</p>
        <div className="strong" style={{ fontSize: 16, marginBottom: 16 }}>{vault.policy.approvalsLow} out of {vault.counts.approvers} approvers.</div>
        <dl className="kv">
          <div><dt>High-risk transfer</dt><dd>{vault.policy.approvalsHigh} of {vault.counts.approvers} approvers, then {fmtDuration(vault.policy.delayHigh)}</dd></div>
          <div><dt>Critical transfer</dt><dd>{vault.policy.approvalsCritical} of {vault.counts.approvers} approvers{vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} of ${vault.counts.guardians} guardians` : ""}, then {fmtDuration(vault.policy.delayCritical)}</dd></div>
          <div><dt>Governance change</dt><dd>{vault.policy.governanceThreshold} of {vault.counts.owners} owners{" "}(+ {fmtDuration(vault.policy.policyChangeDelay)} if security-reducing)</dd></div>
          <div><dt>Recovery</dt><dd>{vault.policy.guardianThreshold} of {vault.counts.guardians} guardians, then {fmtDuration(vault.policy.recoveryDelay)}; any owner can cancel</dd></div>
        </dl>
        <p className="caption" style={{ marginTop: 12 }}>Thresholds are part of the policy. Lowering any of them waits {fmtDuration(vault.policy.policyChangeDelay)} and can be vetoed by a guardian.</p>
      </Section>

      {dialog && (
        <Modal title={existing ? (bits === 0 ? "Remove member" : "Change roles") : "Add member"} onClose={() => setDialog(false)} footer={<><Button kind="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={!isAddress(target) || tx.busy || (existing?.roles === bits)} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeMember", args: [target as `0x${string}`, bits] })}>Propose</Button></>}>
          <Field label="Member address"><input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="0x…" /></Field>
          <div className="field-label" style={{ marginBottom: 8 }}>Roles (none = remove)</div>
          <div className="inline" style={{ gap: 16, marginBottom: 16 }}>
            {[[ROLE_OWNER, "Owner"], [ROLE_APPROVER, "Approver"], [ROLE_EXECUTOR, "Executor"], [ROLE_GUARDIAN, "Guardian"]].map(([b, label]) => (
              <label key={String(b)} className="inline"><input type="checkbox" checked={Boolean(bits & Number(b))} onChange={() => toggle(Number(b))} /> {label}</label>
            ))}
          </div>
          {isAddress(target) && (
            <div className={`notice ${bits === 0 || !reducing ? "notice-ok" : "notice-warn"}`}>
              {bits === 0 ? "Removing a member applies as soon as owners approve." : reducing ? `Adding authority or weakening the guardian layer is security-reducing: it waits ${fmtDuration(vault.policy.policyChangeDelay)} and any guardian can veto it.` : "Reducing authority applies as soon as owners approve."}
            </div>
          )}
          <TxStatus state={tx.state} />
        </Modal>
      )}
    </>
  );
}
