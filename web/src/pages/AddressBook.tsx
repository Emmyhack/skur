import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Address, Button, Empty, Field, Modal, TrustBadge, TxStatus } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { IconBook, IconPlus } from "../components/icons";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtDate, fmtDuration, fmtRelative, nowSec } from "../lib/format";
import { ROLE_APPROVER, ROLE_OWNER, Trust, TRUST_LABEL } from "../lib/types";

/** app.safe.global/address-book: "New entry" action row, then the table. Entries here are onchain recipient records. */
export function AddressBook({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const tx = useTx(() => { onChanged(); setDialog(null); });
  const [dialog, setDialog] = useState<null | "register" | "trust">(null);
  const [target, setTarget] = useState("");
  const [trust, setTrust] = useState<Trust>(Trust.VERIFIED);
  const now = nowSec();

  const openTrust = (addr: string, current: Trust) => {
    setTarget(addr);
    setTrust(current === Trust.UNKNOWN || current === Trust.NEW ? Trust.VERIFIED : current);
    setDialog("trust");
  };

  return (
    <>
      <div className="inline" style={{ marginBottom: 20 }}>
        <Button onClick={() => { setTarget(""); setDialog("register"); }} disabled={!(roles & (ROLE_OWNER | ROLE_APPROVER))} icon={<IconPlus width={16} height={16} />}>New entry</Button>
        <Button kind="secondary" onClick={() => { setTarget(""); setDialog("trust"); }} disabled={!(roles & ROLE_OWNER)}>Propose trust change</Button>
        <span className="caption">A new recipient waits {fmtDuration(vault.policy.recipientActivationDelay)} before normal policy applies to it.</span>
      </div>

      <div className="card flush">
        {vault.activityLoading ? (
          <Empty>Reading recipients from the chain…</Empty>
        ) : vault.recipients.length === 0 ? (
          <Empty icon={<IconBook width={40} height={40} />}>No recipients yet. Register one to start its activation clock.</Empty>
        ) : (
          <table>
            <thead>
              <tr><th>Recipient</th><th>Trust</th><th>Activation</th><th className="num">Payments</th><th>Registered</th><th /></tr>
            </thead>
            <tbody>
              {vault.recipients.map((r) => {
                const probation = r.trust === Trust.NEW && Number(r.activatesAt) > now;
                return (
                  <tr key={r.address}>
                    <td><div className="inline" style={{ gap: 12 }}><Identicon address={r.address} size={32} /><Address value={r.address} full copy prefix="ark" /></div></td>
                    <td><TrustBadge trust={r.trust} /></td>
                    <td>{r.trust === Trust.NEW ? (probation ? `activates ${fmtRelative(r.activatesAt)}` : "activated") : "—"}</td>
                    <td className="num">{String(r.paymentCount)}</td>
                    <td className="muted">{fmtDate(r.registeredAt)}</td>
                    <td className="num"><Button size="sm" kind="ghost" onClick={() => openTrust(r.address, r.trust)} disabled={!(roles & ROLE_OWNER)}>Change trust</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {dialog === "register" && (
        <Modal title="New entry" onClose={() => setDialog(null)} footer={<><Button kind="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={!isAddress(target) || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "registerRecipient", args: [target as `0x${string}`] })}>Register</Button></>}>
          <Field label="Address" hint="Registering starts the activation delay today, so the first payment later does not have to wait.">
            <input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="0x…" autoFocus />
          </Field>
          <TxStatus state={tx.state} />
        </Modal>
      )}
      {dialog === "trust" && (
        <Modal title="Propose a trust change" onClose={() => setDialog(null)} footer={<><Button kind="secondary" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={!isAddress(target) || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeRecipientTrust", args: [target as `0x${string}`, trust] })}>Propose</Button></>}>
          <Field label="Address"><input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="0x…" /></Field>
          <Field label="Trust state" hint="Raising trust loosens security: it waits for the policy-change delay and any guardian can veto it. Restricting or blocking applies as soon as owners approve.">
            <select value={trust} onChange={(e) => setTrust(Number(e.target.value) as Trust)}>
              {[Trust.NEW, Trust.VERIFIED, Trust.TRUSTED, Trust.RESTRICTED, Trust.BLOCKED].map((t) => <option key={t} value={t}>{TRUST_LABEL[t]}</option>)}
            </select>
          </Field>
          <TxStatus state={tx.state} />
        </Modal>
      )}
    </>
  );
}
