import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Address, Button, Card, Empty, Field, TrustBadge, TxStatus } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtDate, fmtDuration, fmtRelative, nowSec } from "../lib/format";
import { ROLE_APPROVER, ROLE_OWNER, Trust, TRUST_LABEL } from "../lib/types";

export function Recipients({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const tx = useTx(onChanged);
  const [reg, setReg] = useState("");
  const [trustTarget, setTrustTarget] = useState("");
  const [trustValue, setTrustValue] = useState<Trust>(Trust.VERIFIED);
  const now = nowSec();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recipients</h1>
          <p className="muted">Recipients are security objects, not just addresses. New ones serve an activation delay of {fmtDuration(vault.policy.recipientActivationDelay)} before normal policy applies.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title="Pre-register a recipient" subtitle="Starts the activation clock before the first payment is proposed.">
          <Field label="Address">
            <input value={reg} onChange={(e) => setReg(e.target.value.trim())} placeholder="0x…" />
          </Field>
          <Button disabled={!isAddress(reg) || !(roles & (ROLE_OWNER | ROLE_APPROVER)) || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "registerRecipient", args: [reg as `0x${string}`] })}>
            Register
          </Button>
        </Card>
        <Card title="Propose a trust change" subtitle="Owner governance. Raising trust is security-reducing and waits for the policy-change delay; restricting or blocking is immediate once approved.">
          <div className="row">
            <Field label="Address">
              <input value={trustTarget} onChange={(e) => setTrustTarget(e.target.value.trim())} placeholder="0x…" />
            </Field>
            <Field label="Trust state">
              <select value={trustValue} onChange={(e) => setTrustValue(Number(e.target.value) as Trust)}>
                {[Trust.NEW, Trust.VERIFIED, Trust.TRUSTED, Trust.RESTRICTED, Trust.BLOCKED].map((t) => (
                  <option key={t} value={t}>
                    {TRUST_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button disabled={!isAddress(trustTarget) || !(roles & ROLE_OWNER) || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeRecipientTrust", args: [trustTarget as `0x${string}`, trustValue] })}>
            Propose
          </Button>
        </Card>
      </div>
      <TxStatus state={tx.state} />

      <Card title="Known recipients" subtitle="From onchain registrations, trust changes and past proposals.">
        {vault.recipients.length === 0 ? (
          <Empty>No recipients yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Trust</th>
                <th>Activation</th>
                <th className="num">Payments</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {vault.recipients.map((r) => {
                const probation = r.trust === Trust.NEW && Number(r.activatesAt) > now;
                return (
                  <tr key={r.address}>
                    <td>
                      <Address value={r.address} />
                    </td>
                    <td>
                      <TrustBadge trust={r.trust} />
                    </td>
                    <td>{r.trust === Trust.NEW ? (probation ? `in probation, activates ${fmtRelative(r.activatesAt)}` : "activated") : "—"}</td>
                    <td className="num">{String(r.paymentCount)}</td>
                    <td>{fmtDate(r.registeredAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
