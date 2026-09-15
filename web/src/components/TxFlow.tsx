import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { isAddress } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { describeError, useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, parseAmount } from "../lib/format";
import { Mode, REASON_RECIPIENT_PROBATION, Tier, Trust } from "../lib/types";
import { RiskReview, type ReviewInput } from "./RiskReview";
import { Button, Field, Modal, TokenIcon, TxStatus } from "./ui";

/**
 * "New transaction" flow, patterned on Safe's send-tokens dialog: details, then a review step that is
 * populated by the vault's own previewTransfer before the wallet is ever asked to sign.
 */
export function TxFlow({ vault, onClose, onChanged, presetAsset }: { vault: VaultData; onClose: () => void; onChanged: () => void; presetAsset?: `0x${string}` }) {
  const client = usePublicClient();
  const approved = vault.assets.filter((a) => a.limits.approved);
  const [step, setStep] = useState<1 | 2>(1);
  const [asset, setAsset] = useState<string>(presetAsset ?? approved[0]?.address ?? "");
  const [to, setTo] = useState("");
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<ReviewInput | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const tx = useTx(() => {
    onChanged();
  });

  const meta = approved.find((a) => a.address === asset);
  const amount = meta ? parseAmount(amountText, meta.decimals) : null;
  const validTo = isAddress(to);
  const detailsOk = Boolean(meta && amount && amount > 0n && validTo);

  useEffect(() => {
    if (step !== 2 || !client || !meta || !validTo || !amount) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(true);
    (async () => {
      try {
        const [r, rec] = await Promise.all([
          client.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "previewTransfer", args: [meta.address, to as `0x${string}`, amount] }),
          client.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "getRecipient", args: [to as `0x${string}`] }),
        ]);
        if (cancelled) return;
        const tier = Number(r.tier) as Tier;
        const reasons = Number(r.reasons);
        const trust = Number(rec.trust) as Trust;
        setPreview({
          asset: meta,
          to: to as `0x${string}`,
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
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, client, meta, to, amount, memo, validTo, vault]);

  const submit = () => {
    if (!meta || !amount || !validTo) return;
    tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeTransfer", args: [meta.address, to as `0x${string}`, amount, memo] });
  };
  const done = tx.state.phase === "done";

  const steps = (
    <>
      <span className={`step ${step === 1 ? "on" : ""}`}><span className="n">1</span> Details</span>
      <span>·</span>
      <span className={`step ${step === 2 ? "on" : ""}`}><span className="n">2</span> Review</span>
    </>
  );

  return (
    <Modal
      title="Send tokens"
      steps={steps}
      onClose={onClose}
      footer={
        step === 1 ? (
          <>
            <Button kind="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setStep(2)} disabled={!detailsOk}>Continue</Button>
          </>
        ) : done ? (
          <>
            <span />
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button kind="secondary" onClick={() => setStep(1)} disabled={tx.busy}>Back</Button>
            <Button onClick={submit} disabled={!preview || tx.busy}>Propose transaction</Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <Field label="Recipient address" hint={validTo || !to ? "Addresses this vault has never paid are registered as New and wait their activation delay." : "Not a valid address"}>
            <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" list="known-recipients" autoFocus />
            <datalist id="known-recipients">
              {vault.recipients.map((r) => (
                <option key={r.address} value={r.address} />
              ))}
            </datalist>
          </Field>
          <div className="row">
            <Field label="Asset">
              <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                {approved.map((a) => (
                  <option key={a.address} value={a.address}>
                    {a.symbol} · {fmtAmount(a.balance, a.decimals)} available
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" inputMode="decimal" />
            </Field>
          </div>
          <Field label="Purpose" hint="Recorded onchain in the proposal event so approvers know what they are signing.">
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Invoice 1042 – design retainer" maxLength={140} />
          </Field>
        </>
      ) : (
        <>
          {meta && amount && (
            <div className="inline" style={{ marginBottom: 16 }}>
              <TokenIcon symbol={meta.symbol} />
              <div>
                <div className="strong num" style={{ fontSize: 20 }}>{fmtAmount(amount, meta.decimals, meta.symbol)}</div>
                <div className="caption">to {to}</div>
              </div>
            </div>
          )}
          {loadingPreview && <div className="notice notice-info">Asking the vault how it would classify this transfer…</div>}
          {previewError && <div className="notice notice-bad">{previewError}</div>}
          {preview && <RiskReview r={preview} />}
          <TxStatus state={tx.state} />
        </>
      )}
    </Modal>
  );
}
