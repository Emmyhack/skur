import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Badge, Button, Card, Field, TxLink, TxStatus } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDate, fmtDuration, parseAmount } from "../lib/format";
import { limitReductions, policyReductions, policyToContract, validateCounts, validateLimits, validatePolicy } from "../lib/policy";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import { ROLE_OWNER, type AssetLimits, type Policy } from "../lib/types";

const HOURS = 3600;

const FIELDS: Array<{ key: keyof Policy; label: string; unit: "count" | "hours" | "bps" | "bool"; hint: string }> = [
  { key: "approvalsLow", label: "Approvals · Low tier", unit: "count", hint: "Routine payments." },
  { key: "approvalsHigh", label: "Approvals · High tier", unit: "count", hint: "" },
  { key: "approvalsCritical", label: "Approvals · Critical tier", unit: "count", hint: "" },
  { key: "governanceThreshold", label: "Owner approvals for governance", unit: "count", hint: "Policy, limits, members, trust, mode." },
  { key: "guardianThreshold", label: "Guardian confirmations", unit: "count", hint: "For critical transfers, leaving lockdown and recovery." },
  { key: "guardianRequiredCritical", label: "Guardian required for Critical", unit: "bool", hint: "" },
  { key: "delayHigh", label: "High-tier delay", unit: "hours", hint: "" },
  { key: "delayCritical", label: "Critical delay (veto window)", unit: "hours", hint: "" },
  { key: "recipientActivationDelay", label: "New-recipient activation delay", unit: "hours", hint: "" },
  { key: "policyChangeDelay", label: "Security-reducing change delay", unit: "hours", hint: "" },
  { key: "recoveryDelay", label: "Recovery delay", unit: "hours", hint: "Owners can cancel during it." },
  { key: "proposalTtl", label: "Proposal lifetime", unit: "hours", hint: "Must exceed the longest delay by 1h." },
  { key: "highExposureBps", label: "Exposure → High", unit: "bps", hint: "% of asset holdings." },
  { key: "criticalExposureBps", label: "Exposure → Critical", unit: "bps", hint: "" },
  { key: "hardBlockExposureBps", label: "Exposure hard block", unit: "bps", hint: "0 disables." },
  { key: "envelopeBps", label: "Loss envelope", unit: "bps", hint: "% of holdings per window; trips Lockdown. 0 disables." },
  { key: "envelopeWindow", label: "Envelope window", unit: "hours", hint: "" },
];

export function Policies({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const isOwner = Boolean((me?.roles ?? 0) & ROLE_OWNER);
  const [draft, setDraft] = useState<Policy>(vault.policy);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const tx = useTx(onChanged);

  const errors = useMemo(
    () => [...validatePolicy(draft), ...validateCounts(draft, vault.counts.owners, vault.counts.approvers, vault.counts.executors, vault.counts.guardians)],
    [draft, vault.counts],
  );
  const reductions = useMemo(() => policyReductions(vault.policy, draft), [vault.policy, draft]);
  const changed = JSON.stringify(draft) !== JSON.stringify(vault.policy);

  const set = (k: keyof Policy, v: number | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Policies</h1>
          <p className="muted">Version {vault.policyVersion}. Loosening any control waits {fmtDuration(vault.policy.policyChangeDelay)} and can be vetoed by a guardian. Tightening applies as soon as owners approve.</p>
        </div>
      </div>

      <Card title="Templates" subtitle="Start from a profile instead of designing a policy from first principles. Selecting one only fills the editor.">
        <div className="templates">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`template ${template === t.id ? "active" : ""}`} onClick={() => { setTemplate(t.id); setDraft(t.policy); }}>
              <strong>{t.name}</strong>
              <span className="small muted">{t.tagline}</span>
              <div className="small muted" style={{ marginTop: 6 }}>
                needs {t.minSigners}+ signers, {t.minGuardians}+ guardian{t.minGuardians === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Policy editor"
        subtitle="Values are validated with the same rules the contract applies."
        actions={
          <>
            <Button kind="secondary" onClick={() => { setDraft(vault.policy); setTemplate(null); }} disabled={!changed}>
              Reset
            </Button>
            <Button disabled={!isOwner || !changed || errors.length > 0 || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposePolicy", args: [policyToContract(draft)] })}>
              Propose policy
            </Button>
          </>
        }
      >
        <div className="grid grid-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint || undefined}>
              {f.unit === "bool" ? (
                <select value={draft[f.key] ? "1" : "0"} onChange={(e) => set(f.key, e.target.value === "1")}>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              ) : f.unit === "hours" ? (
                <input type="number" min={0} step={1} value={Number(draft[f.key]) / HOURS} onChange={(e) => set(f.key, Math.round(Number(e.target.value) * HOURS))} />
              ) : f.unit === "bps" ? (
                <input type="number" min={0} max={100} step={0.5} value={Number(draft[f.key]) / 100} onChange={(e) => set(f.key, Math.round(Number(e.target.value) * 100))} />
              ) : (
                <input type="number" min={0} step={1} value={Number(draft[f.key])} onChange={(e) => set(f.key, Number(e.target.value))} />
              )}
            </Field>
          ))}
        </div>
        {errors.length > 0 && (
          <div className="notice notice-bad">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        {changed && errors.length === 0 && (
          <div className={`notice ${reductions.length ? "notice-warn" : "notice-ok"}`}>
            {reductions.length ? (
              <>
                <strong>Security-reducing change.</strong> It will wait {fmtDuration(vault.policy.policyChangeDelay)} after owner approval and any guardian can veto it: {reductions.join("; ")}.
              </>
            ) : (
              <>
                <strong>Tightening-only change.</strong> It activates as soon as {vault.policy.governanceThreshold} owner{vault.policy.governanceThreshold === 1 ? "" : "s"} approve.
              </>
            )}
          </div>
        )}
        <TxStatus state={tx.state} />
      </Card>

      <AssetLimitsEditor vault={vault} onChanged={onChanged} isOwner={isOwner} />

      <Card title="Policy history" subtitle="Every activation is emitted onchain.">
        {vault.policyHistory.length === 0 ? (
          <p className="muted">No history indexed.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Activated</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {[...vault.policyHistory].reverse().map((h) => (
                <tr key={h.version}>
                  <td>v{h.version}</td>
                  <td>{fmtDate(h.activatedAt)}</td>
                  <td>
                    <TxLink hash={h.txHash} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function AssetLimitsEditor({ vault, onChanged, isOwner }: { vault: VaultData; onChanged: () => void; isOwner: boolean }) {
  const tx = useTx(onChanged);
  const [assetAddr, setAssetAddr] = useState<string>(vault.assets[0]?.address ?? "");
  const meta = vault.assets.find((a) => a.address === assetAddr);
  const decimals = meta?.decimals ?? 18;
  const [text, setText] = useState(() => ({
    approved: meta?.limits.approved ?? true,
    lowMax: meta ? fmtAmount(meta.limits.lowMax, decimals, undefined, 6) : "",
    highMax: meta ? fmtAmount(meta.limits.highMax, decimals, undefined, 6) : "",
    perTxMax: meta ? fmtAmount(meta.limits.perTxMax, decimals, undefined, 6) : "",
    dailyMax: meta ? fmtAmount(meta.limits.dailyMax, decimals, undefined, 6) : "",
  }));
  const pick = (addr: string) => {
    setAssetAddr(addr);
    const m = vault.assets.find((a) => a.address === addr);
    if (m) {
      setText({
        approved: m.limits.approved,
        lowMax: fmtAmount(m.limits.lowMax, m.decimals, undefined, 6),
        highMax: fmtAmount(m.limits.highMax, m.decimals, undefined, 6),
        perTxMax: fmtAmount(m.limits.perTxMax, m.decimals, undefined, 6),
        dailyMax: fmtAmount(m.limits.dailyMax, m.decimals, undefined, 6),
      });
    } else {
      setText({ approved: true, lowMax: "", highMax: "", perTxMax: "0", dailyMax: "0" });
    }
  };
  const parsed: AssetLimits | null = (() => {
    const l = parseAmount(text.lowMax || "0", decimals);
    const h = parseAmount(text.highMax || "0", decimals);
    const p = parseAmount(text.perTxMax || "0", decimals);
    const d = parseAmount(text.dailyMax || "0", decimals);
    if (l === null || h === null || p === null || d === null) return null;
    return { approved: text.approved, lowMax: l, highMax: h, perTxMax: p, dailyMax: d };
  })();
  const errors = parsed ? validateLimits(parsed) : ["Enter valid amounts."];
  const current = meta?.limits ?? { approved: false, lowMax: 0n, highMax: 0n, perTxMax: 0n, dailyMax: 0n };
  const reductions = parsed ? limitReductions(current, parsed) : [];

  return (
    <Card title="Asset limits" subtitle="Per-asset tiers and caps, in the asset's own units. Approving a new asset is a security-reducing change.">
      <div className="row">
        <Field label="Asset">
          <input value={assetAddr} onChange={(e) => pick(e.target.value.trim())} list="assets" placeholder="0x… (address(0) is KASH)" />
          <datalist id="assets">
            {vault.assets.map((a) => (
              <option key={a.address} value={a.address}>
                {a.symbol}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Approved">
          <select value={text.approved ? "1" : "0"} onChange={(e) => setText((t) => ({ ...t, approved: e.target.value === "1" }))}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </Field>
      </div>
      <div className="row">
        <Field label={`Low tier up to (${meta?.symbol ?? "units"})`}>
          <input value={text.lowMax} onChange={(e) => setText((t) => ({ ...t, lowMax: e.target.value }))} />
        </Field>
        <Field label="High tier up to">
          <input value={text.highMax} onChange={(e) => setText((t) => ({ ...t, highMax: e.target.value }))} />
        </Field>
        <Field label="Per-transaction cap (0 = none)">
          <input value={text.perTxMax} onChange={(e) => setText((t) => ({ ...t, perTxMax: e.target.value }))} />
        </Field>
        <Field label="Daily cap (0 = none)">
          <input value={text.dailyMax} onChange={(e) => setText((t) => ({ ...t, dailyMax: e.target.value }))} />
        </Field>
      </div>
      {meta && (
        <p className="small muted">
          Current: low ≤ {fmtAmount(current.lowMax, decimals)}, high ≤ {fmtAmount(current.highMax, decimals)}, per-tx {current.perTxMax ? fmtAmount(current.perTxMax, decimals) : "none"}, daily {current.dailyMax ? fmtAmount(current.dailyMax, decimals) : "none"} · exposure thresholds {fmtBps(vault.policy.highExposureBps)} / {fmtBps(vault.policy.criticalExposureBps)}
        </p>
      )}
      {errors.length > 0 && <div className="notice notice-bad">{errors.join(" ")}</div>}
      {errors.length === 0 && (
        <div className={`notice ${reductions.length ? "notice-warn" : "notice-ok"}`}>
          {reductions.length ? <>Security-reducing: {reductions.join("; ")}. Delayed and vetoable.</> : <>Tightening-only: applies once owners approve.</>}
        </div>
      )}
      <div className="inline">
        <Button disabled={!isOwner || !parsed || errors.length > 0 || tx.busy || !assetAddr} onClick={() => parsed && tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeAssetLimits", args: [assetAddr as `0x${string}`, parsed] })}>
          Propose limits
        </Button>
        {reductions.length > 0 && <Badge tone="warn">Delayed {fmtDuration(vault.policy.policyChangeDelay)}</Badge>}
      </div>
      <TxStatus state={tx.state} />
    </Card>
  );
}
