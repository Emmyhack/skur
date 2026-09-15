import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Address, Badge, Button, Card, Field, TxStatus } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtDuration } from "../lib/format";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, roleNames } from "../lib/types";

export function Members({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const isOwner = Boolean((me?.roles ?? 0) & ROLE_OWNER);
  const tx = useTx(onChanged);
  const [target, setTarget] = useState("");
  const [bits, setBits] = useState(0);
  const toggle = (b: number) => setBits((x) => (x & b ? x & ~b : b === ROLE_GUARDIAN ? ROLE_GUARDIAN : (x | b) & ~ROLE_GUARDIAN));
  const existing = vault.members.find((m) => m.address.toLowerCase() === target.toLowerCase());
  const adds = existing ? bits & ~existing.roles : bits;
  const reducing = adds !== 0 || (existing && existing.roles & ROLE_GUARDIAN && !(bits & ROLE_GUARDIAN));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p className="muted">Owners run governance, approvers approve payments, executors execute, guardians can only freeze, veto and recover. Guardians never hold treasury roles.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title="Current members">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {vault.members.map((m) => (
                <tr key={m.address}>
                  <td>
                    <Address value={m.address} />
                    {m.address.toLowerCase() === address?.toLowerCase() && <span className="muted small"> (you)</span>}
                  </td>
                  <td className="inline">
                    {roleNames(m.roles).map((r) => (
                      <Badge key={r} tone={r === "Guardian" ? "info" : "neutral"}>
                        {r}
                      </Badge>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 10 }}>
            {vault.counts.owners} owners · {vault.counts.approvers} approvers · {vault.counts.executors} executors · {vault.counts.guardians} guardians. Governance threshold {vault.policy.governanceThreshold}; critical transfers need {vault.policy.approvalsCritical} approvals.
          </p>
        </Card>

        <Card title="Propose a membership change" subtitle={`Owner governance. Adding authority waits ${fmtDuration(vault.policy.policyChangeDelay)} and is vetoable; removing authority applies once approved.`}>
          <Field label="Member address">
            <input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="0x…" />
          </Field>
          <Field label="Roles (leave all unchecked to remove)">
            <div className="inline">
              {[
                [ROLE_OWNER, "Owner"],
                [ROLE_APPROVER, "Approver"],
                [ROLE_EXECUTOR, "Executor"],
                [ROLE_GUARDIAN, "Guardian"],
              ].map(([b, label]) => (
                <label key={String(b)} className="inline">
                  <input type="checkbox" style={{ width: "auto" }} checked={Boolean(bits & Number(b))} onChange={() => toggle(Number(b))} /> {label}
                </label>
              ))}
            </div>
          </Field>
          {isAddress(target) && (
            <p className="small muted">
              {existing ? `Currently ${roleNames(existing.roles).join(" + ") || "none"}. ` : "Not a member yet. "}
              {bits === 0 ? "This removes the member." : reducing ? "This adds authority or weakens the guardian layer: delayed and vetoable." : "This only reduces authority: immediate once approved."}
            </p>
          )}
          <Button disabled={!isAddress(target) || !isOwner || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeMember", args: [target as `0x${string}`, bits] })}>
            Propose
          </Button>
          <TxStatus state={tx.state} />
        </Card>
      </div>
    </>
  );
}
