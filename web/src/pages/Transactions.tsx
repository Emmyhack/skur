import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { ProposalCard } from "../components/ProposalCard";
import { RiskReview, type ReviewInput } from "../components/RiskReview";
import { Button, Card, Empty, Field, TxStatus } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { describeError } from "../hooks/useTx";
import { fmtAmount, parseAmount } from "../lib/format";
import { Kind, Mode, ROLE_APPROVER, ROLE_OWNER, Status, Tier, Trust, REASON_RECIPIENT_PROBATION } from "../lib/types";

type Filter = "pending" | "all" | "transfers" | "governance";

export function Transactions({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [showNew, setShowNew] = useState(false);
  const list = useMemo(() => {
    return vault.proposals.filter((p) => {
      if (filter === "pending") return p.status === Status.PENDING;
      if (filter === "transfers") return p.kind === Kind.TRANSFER;
      if (filter === "governance") return p.kind !== Kind.TRANSFER;
      return true;
    });
  }, [vault.proposals, filter]);

  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const canPropose = Boolean((me?.roles ?? 0) & (ROLE_OWNER | ROLE_APPROVER)) && vault.mode !== Mode.LOCKDOWN;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p className="muted">Proposals, approvals, risk tier and status. Every requirement below is computed by the vault contract.</p>
        </div>
        <Button onClick={() => setShowNew((s) => !s)} disabled={!canPropose} title={!canPropose ? (vault.mode === Mode.LOCKDOWN ? "Vault is in Lockdown" : "Owner or approver role required") : undefined}>
          {showNew ? "Close" : "New transfer"}
        </Button>
      </div>

      {showNew && <NewTransfer vault={vault} onChanged={() => { onChanged(); setShowNew(false); }} />}

      <div className="tabs">
        {(["pending", "all", "transfers", "governance"] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {list.length === 0 ? <Empty>No proposals match this filter.</Empty> : list.map((p) => <ProposalCard key={String(p.id)} p={p} vault={vault} onChanged={onChanged} />)}
    </>
  );
}

function NewTransfer({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const client = usePublicClient();
  const tx = useTx(onChanged);
  const approved = vault.assets.filter((a) => a.limits.approved);
  const [asset, setAsset] = useState<string>(approved[0]?.address ?? "");
  const [to, setTo] = useState("");
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<ReviewInput | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const meta = approved.find((a) => a.address === asset);
  const amount = meta ? parseAmount(amountText, meta.decimals) : null;
  const validTo = isAddress(to);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    if (!client || !meta || !validTo || !amount || amount <= 0n) return;
    const t = setTimeout(async () => {
      try {
        const [r, rec] = await Promise.all([
          client.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "previewTransfer", args: [meta.address, to as `0x${string}`, amount] }),
          client.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "getRecipient", args: [to as `0x${string}`] }),
        ]);
        if (cancelled) return;
        const tier = Number(r.tier) as Tier;
        const reasons = Number(r.reasons);
        const trust = Number(rec.trust) as Trust;
        const known = vault.recipients.find((x) => x.address.toLowerCase() === to.toLowerCase());
        setPreview({
          asset: meta,
          to: to as `0x${string}`,
          toLabel: known ? undefined : undefined,
          amount,
          memo,
          tier,
          reasons,
          exposureBps: Number(r.exposureBps),
          requiredApprovals: Number(r.requiredApprovals),
          requiredGuardians: Number(r.requiredGuardians),
          delay: Number(r.delay),
          trust,
          activatesAt: trust === Trust.UNKNOWN ? BigInt(Math.floor(Date.now() / 1000) + vault.policy.recipientActivationDelay) : rec.activatesAt,
          vetoable: tier === Tier.CRITICAL || Boolean(reasons & REASON_RECIPIENT_PROBATION) || vault.mode !== Mode.NORMAL,
        });
      } catch (e) {
        if (!cancelled) setPreviewError(describeError(e));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [client, meta, to, amount, memo, validTo, vault]);

  const submit = () => {
    if (!meta || !amount || !validTo) return;
    tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeTransfer", args: [meta.address, to as `0x${string}`, amount, memo] });
  };

  return (
    <Card title="New transfer proposal" subtitle="The review below is read from the vault before your wallet is asked to sign.">
      <div className="row">
        <Field label="Asset">
          <select value={asset} onChange={(e) => setAsset(e.target.value)}>
            {approved.map((a) => (
              <option key={a.address} value={a.address}>
                {a.symbol} · balance {fmtAmount(a.balance, a.decimals)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" inputMode="decimal" />
        </Field>
      </div>
      <Field label="Recipient address" hint={validTo || !to ? "Addresses never paid before are registered as New and wait their activation delay." : "Not a valid address"}>
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" list="known-recipients" />
        <datalist id="known-recipients">
          {vault.recipients.map((r) => (
            <option key={r.address} value={r.address} />
          ))}
        </datalist>
      </Field>
      <Field label="Purpose (recorded onchain in the proposal event)">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Invoice 1042 – design retainer" maxLength={140} />
      </Field>
      {previewError && <div className="notice notice-bad">{previewError}</div>}
      {preview && <RiskReview r={preview} />}
      <div style={{ marginTop: 12 }}>
        <Button onClick={submit} disabled={!preview || tx.busy}>
          Propose transfer
        </Button>
      </div>
      <TxStatus state={tx.state} />
    </Card>
  );
}
