import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Badge, Button, Section, TxLink, TxStatus } from "../components/ui";
import { TokenIcon } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDate, fmtDuration, parseAmount } from "../lib/format";
import { limitReductions, policyReductions, policyToContract, validateCounts, validateLimits, validatePolicy } from "../lib/policy";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import { ROLE_OWNER, type AssetLimits, type Policy } from "../lib/types";

const H = 3600;
type Unit = "count" | "hours" | "bps" | "bool";
type F = { key: keyof Policy; label: string; hint: string; unit: Unit; max?: number };

const GROUPS: Array<{ title: string; sub: string; fields: F[] }> = [
  {
    title: "Approvals",
    sub: "How many confirmations each tier needs. Guardians confirm critical transfers in addition to approvers.",
    fields: [
      { key: "approvalsLow", label: "Low tier", hint: "Routine payments under the routine threshold.", unit: "count" },
      { key: "approvalsHigh", label: "High tier", hint: "Larger payments, new recipients, elevated posture.", unit: "count" },
      { key: "approvalsCritical", label: "Critical tier", hint: "Very large or high-exposure payments.", unit: "count" },
      { key: "guardianRequiredCritical", label: "Guardian required for Critical", hint: "An independent sign-off on the largest transfers.", unit: "bool" },
      { key: "guardianThreshold", label: "Guardian confirmations", hint: "For critical transfers, leaving Lockdown and recovery.", unit: "count" },
      { key: "governanceThreshold", label: "Owner approvals for governance", hint: "Policy, limits, members, trust, mode changes.", unit: "count" },
    ],
  },
  {
    title: "Delays",
    sub: "A delay gives guardians a veto window and gives the organisation time to notice.",
    fields: [
      { key: "delayHigh", label: "High-tier delay", hint: "Between full approval and execution.", unit: "hours" },
      { key: "delayCritical", label: "Critical delay", hint: "Also the guardian veto window.", unit: "hours" },
      { key: "recipientActivationDelay", label: "New-recipient activation", hint: "A never-seen address cannot be paid sooner.", unit: "hours" },
      { key: "policyChangeDelay", label: "Security-reducing change delay", hint: "Any loosening waits this long and can be vetoed.", unit: "hours" },
      { key: "recoveryDelay", label: "Recovery delay", hint: "Owners can cancel a recovery during it.", unit: "hours" },
      { key: "proposalTtl", label: "Proposal lifetime", hint: "Must exceed the longest delay by at least 1h.", unit: "hours" },
    ],
  },
  {
    title: "Exposure",
    sub: "Share of the asset's holdings that a single payment may move before it is escalated or refused.",
    fields: [
      { key: "highExposureBps", label: "Escalate to High at", hint: "Percent of holdings.", unit: "bps", max: 100 },
      { key: "criticalExposureBps", label: "Escalate to Critical at", hint: "", unit: "bps", max: 100 },
      { key: "hardBlockExposureBps", label: "Refuse above", hint: "0 disables the hard block.", unit: "bps", max: 100 },
    ],
  },
  {
    title: "Circuit breaker",
    sub: "Cumulative outflow per window as a share of holdings. The transfer that would exceed it is not paid; the vault enters Lockdown.",
    fields: [
      { key: "envelopeBps", label: "Loss envelope", hint: "0 disables the breaker.", unit: "bps", max: 100 },
      { key: "envelopeWindow", label: "Envelope window", hint: "At least 1 hour.", unit: "hours" },
    ],
  },
];

function Control({ f, value, onChange }: { f: F; value: number | boolean; onChange: (v: number | boolean) => void }) {
  if (f.unit === "bool") {
    return (
      <select value={value ? "1" : "0"} onChange={(e) => onChange(e.target.value === "1")}>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
    );
  }
  if (f.unit === "count") {
    const n = Number(value);
    return (
      <span className="stepper">
        <button onClick={() => onChange(Math.max(0, n - 1))} type="button">−</button>
        <input type="number" min={0} value={n} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} />
        <button onClick={() => onChange(n + 1)} type="button">+</button>
      </span>
    );
  }
  if (f.unit === "hours") {
    return (
      <span className="unit">
        <input type="number" min={0} step={1} value={Number(value) / H} onChange={(e) => onChange(Math.round(Number(e.target.value) * H))} />
        <span>hours</span>
      </span>
    );
  }
  return (
    <span className="unit">
      <input type="number" min={0} max={f.max ?? 100} step={0.5} value={Number(value) / 100} onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))} />
      <span>%</span>
    </span>
  );
}

/** Policy editor laid out like Safe's settings: a label column, then grouped controls with live validation. */
export function Policies({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const isOwner = Boolean((me?.roles ?? 0) & ROLE_OWNER);
  const [draft, setDraft] = useState<Policy>(vault.policy);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const tx = useTx(() => { onChanged(); });
  const errors = useMemo(() => [...validatePolicy(draft), ...validateCounts(draft, vault.counts.owners, vault.counts.approvers, vault.counts.executors, vault.counts.guardians)], [draft, vault.counts]);
  const reductions = useMemo(() => policyReductions(vault.policy, draft), [vault.policy, draft]);
  const changed = JSON.stringify(draft) !== JSON.stringify(vault.policy);
  const set = (k: keyof Policy, v: number | boolean) => setDraft((d) => ({ ...d, [k]: v }));
  const changedKeys = new Set((Object.keys(draft) as Array<keyof Policy>).filter((k) => draft[k] !== vault.policy[k]));

  return (
    <>
      <div className="scorecard">
        <div><div className="v">v{vault.policyVersion}</div><div className="l">Active policy version</div></div>
        <div><div className="v">{vault.policy.approvalsLow}·{vault.policy.approvalsHigh}·{vault.policy.approvalsCritical}</div><div className="l">Approvals low · high · critical</div></div>
        <div><div className="v">{fmtDuration(vault.policy.delayCritical)}</div><div className="l">Critical delay & veto window</div></div>
        <div><div className="v">{vault.policy.envelopeBps ? fmtBps(vault.policy.envelopeBps) : "off"}</div><div className="l">Loss envelope per {fmtDuration(vault.policy.envelopeWindow)}</div></div>
      </div>

      <Section title={<>Templates<small>Start from a profile instead of designing a policy from scratch. Choosing one only fills the editor; nothing is proposed until you say so.</small></>}>
        <div className="templates">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`template ${template === t.id ? "active" : ""}`} onClick={() => { setTemplate(t.id); setDraft(t.policy); }}>
              <strong>{t.name}</strong>
              <span className="caption">{t.tagline}</span>
            </button>
          ))}
        </div>
      </Section>

      {GROUPS.map((g) => (
        <Section key={g.title} title={<>{g.title}<small>{g.sub}</small></>}>
          {g.fields.map((f) => (
            <div key={f.key} className={`pfield ${changedKeys.has(f.key) ? "changed" : ""}`}>
              <div>
                <div className="lbl">{f.label}</div>
                {f.hint && <div className="hint">{f.hint}</div>}
                {changedKeys.has(f.key) && <div className="hint">was {f.unit === "bool" ? (vault.policy[f.key] ? "Yes" : "No") : f.unit === "hours" ? fmtDuration(Number(vault.policy[f.key])) : f.unit === "bps" ? fmtBps(Number(vault.policy[f.key])) : String(vault.policy[f.key])}</div>}
              </div>
              <Control f={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
            </div>
          ))}
        </Section>
      ))}

      <Section title={<>Propose<small>The checks here mirror the contract's own validation. The contract has the final say.</small></>}>
        {errors.length > 0 && <div className="notice notice-bad"><div>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>}
        {changed && errors.length === 0 && (
          <div className={`notice ${reductions.length ? "notice-warn" : "notice-ok"}`}>
            <div>
              {reductions.length ? (
                <><strong>Security-reducing change.</strong> It waits {fmtDuration(vault.policy.policyChangeDelay)} after {vault.policy.governanceThreshold} owner approval{vault.policy.governanceThreshold === 1 ? "" : "s"} and any guardian can veto it: {reductions.join("; ")}.</>
              ) : (
                <><strong>Tightening-only change.</strong> It activates as soon as {vault.policy.governanceThreshold} owner{vault.policy.governanceThreshold === 1 ? "" : "s"} approve.</>
              )}
            </div>
          </div>
        )}
        {!changed && <p className="desc">Nothing has changed yet. Edit a value above or pick a template.</p>}
        <div className="inline">
          <Button disabled={!isOwner || !changed || errors.length > 0 || tx.busy} onClick={() => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposePolicy", args: [policyToContract(draft)] })}>Propose policy</Button>
          <Button kind="secondary" onClick={() => { setDraft(vault.policy); setTemplate(null); }} disabled={!changed}>Reset</Button>
          {!isOwner && <span className="caption">Connect an owner wallet to propose.</span>}
        </div>
        <TxStatus state={tx.state} />
      </Section>

      <AssetLimitsSection vault={vault} onChanged={onChanged} isOwner={isOwner} />

      <Section title={<>History<small>Every activated policy version is recorded onchain.</small></>}>
        {vault.policyHistory.length === 0 ? (
          <p className="desc">No policy versions recorded yet.</p>
        ) : (
          <dl className="kv">
            {[...vault.policyHistory].reverse().map((h) => (
              <div key={h.version}><dt>Version {h.version}</dt><dd>{fmtDate(h.activatedAt)} · <TxLink hash={h.txHash} /></dd></div>
            ))}
          </dl>
        )}
      </Section>
    </>
  );
}

function AssetLimitsSection({ vault, onChanged, isOwner }: { vault: VaultData; onChanged: () => void; isOwner: boolean }) {
  const tx = useTx(onChanged);
  const [assetAddr, setAssetAddr] = useState<string>(vault.assets[0]?.address ?? "");
  const meta = vault.assets.find((a) => a.address === assetAddr);
  const decimals = meta?.decimals ?? 18;
  const fresh = (m?: typeof meta) => ({
    approved: m?.limits.approved ?? true,
    lowMax: m ? fmtAmount(m.limits.lowMax, m.decimals, undefined, 6) : "",
    highMax: m ? fmtAmount(m.limits.highMax, m.decimals, undefined, 6) : "",
    perTxMax: m ? fmtAmount(m.limits.perTxMax, m.decimals, undefined, 6) : "0",
    dailyMax: m ? fmtAmount(m.limits.dailyMax, m.decimals, undefined, 6) : "0",
  });
  const [text, setText] = useState(() => fresh(meta));
  const pick = (addr: string) => { setAssetAddr(addr); setText(fresh(vault.assets.find((a) => a.address === addr))); };
  const parsed: AssetLimits | null = (() => {
    const l = parseAmount(text.lowMax || "0", decimals), h = parseAmount(text.highMax || "0", decimals), p = parseAmount(text.perTxMax || "0", decimals), d = parseAmount(text.dailyMax || "0", decimals);
    if (l === null || h === null || p === null || d === null) return null;
    return { approved: text.approved, lowMax: l, highMax: h, perTxMax: p, dailyMax: d };
  })();
  const errors = parsed ? validateLimits(parsed) : ["Enter valid amounts."];
  const current = meta?.limits ?? { approved: false, lowMax: 0n, highMax: 0n, perTxMax: 0n, dailyMax: 0n };
  const reductions = parsed ? limitReductions(current, parsed) : [];

  return (
    <Section title={<>Asset limits<small>Tiers and caps for each asset, in that asset's own units. Approving a new asset loosens security and goes through the delayed path.</small></>}>
      <div className="inline" style={{ marginBottom: 16 }}>
        {vault.assets.map((a) => (
          <button key={a.address} className={`template ${assetAddr === a.address ? "active" : ""}`} style={{ padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => pick(a.address)}>
            <TokenIcon symbol={a.symbol} size={22} /> {a.symbol}
          </button>
        ))}
        <input value={assetAddr} onChange={(e) => pick(e.target.value.trim())} placeholder="or paste a token address" style={{ maxWidth: 320, height: 40 }} />
      </div>
      <div className="pfield"><div><div className="lbl">Approved</div><div className="hint">Unapproved assets cannot be paid out.</div></div><select value={text.approved ? "1" : "0"} onChange={(e) => setText((t) => ({ ...t, approved: e.target.value === "1" }))}><option value="1">Yes</option><option value="0">No</option></select></div>
      <div className="pfield"><div><div className="lbl">Routine up to</div><div className="hint">At or below this amount a payment is Low tier.</div></div><input value={text.lowMax} onChange={(e) => setText((t) => ({ ...t, lowMax: e.target.value }))} /></div>
      <div className="pfield"><div><div className="lbl">High up to</div><div className="hint">Above this a payment is Critical.</div></div><input value={text.highMax} onChange={(e) => setText((t) => ({ ...t, highMax: e.target.value }))} /></div>
      <div className="pfield"><div><div className="lbl">Per-transaction cap</div><div className="hint">0 = no cap.</div></div><input value={text.perTxMax} onChange={(e) => setText((t) => ({ ...t, perTxMax: e.target.value }))} /></div>
      <div className="pfield"><div><div className="lbl">Daily cap</div><div className="hint">Cumulative per 24h bucket. 0 = no cap.</div></div><input value={text.dailyMax} onChange={(e) => setText((t) => ({ ...t, dailyMax: e.target.value }))} /></div>
      {errors.length > 0 ? <div className="notice notice-bad">{errors.join(" ")}</div> : (
        <div className={`notice ${reductions.length ? "notice-warn" : "notice-ok"}`}>{reductions.length ? <>Security-reducing: {reductions.join("; ")}. Delayed {fmtDuration(vault.policy.policyChangeDelay)} and vetoable.</> : <>Tightening-only: applies once owners approve.</>}</div>
      )}
      <div className="inline">
        <Button disabled={!isOwner || !parsed || errors.length > 0 || tx.busy || !assetAddr} onClick={() => parsed && tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeAssetLimits", args: [assetAddr as `0x${string}`, parsed] })}>Propose limits</Button>
        {reductions.length > 0 && <Badge tone="warn">Delayed {fmtDuration(vault.policy.policyChangeDelay)}</Badge>}
      </div>
      <TxStatus state={tx.state} />
    </Section>
  );
}
