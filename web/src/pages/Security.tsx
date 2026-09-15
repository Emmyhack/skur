import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { isAddress, stringToHex } from "viem";
import { useQuery } from "@tanstack/react-query";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Address, Badge, Button, CopyButton, Field, KV, Section, TxLink, TxStatus } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtDuration } from "../lib/format";
import { computeMaxLoss } from "../lib/maxLoss";
import { Mode, MODE_LABEL, ROLE_GUARDIAN, ROLE_OWNER } from "../lib/types";

export function Security({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const tx = useTx(onChanged);
  const [reason, setReason] = useState("");
  const [oldSigner, setOldSigner] = useState("");
  const [newSigner, setNewSigner] = useState("");
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);
  const call = (functionName: string, args: readonly unknown[]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName, args });
  const r32 = stringToHex(reason.slice(0, 31) || "manual", { size: 32 });
  const items = postureItems(vault);
  const okCount = items.filter((i) => i.ok === "ok").length;
  const pct = Math.round((okCount / items.length) * 100);

  return (
    <>
      <div className="scorecard">
        <div>
          <div className="gauge">
            <div className="ring" style={{ ["--pct" as string]: pct }}><span>{pct}%</span></div>
            <div><div className="v" style={{ fontSize: 18 }}>Posture</div><div className="l">{okCount} of {items.length} controls confirmed</div></div>
          </div>
        </div>
        <div><div className="v">{MODE_LABEL[vault.mode]}</div><div className="l">Security mode</div></div>
        <div><div className="v">{guardians.length}</div><div className="l">Guardian{guardians.length === 1 ? "" : "s"} · {vault.policy.guardianThreshold} to confirm</div></div>
        <div><div className="v">{fmtDuration(vault.policy.delayCritical)}</div><div className="l">Critical veto window</div></div>
      </div>

      <Section title={<>Security mode<small>Owners and guardians raise the mode instantly. Lowering it needs owners plus guardians, and leaving Lockdown also waits the policy-change delay.</small></>}>
        <div className="mode-hero">
          {[
            [Mode.NORMAL, "Normal", "Routine policy, standard approvals."],
            [Mode.ELEVATED, "Elevated", "Every transfer one tier higher; per-transaction and daily caps halved."],
            [Mode.LOCKDOWN, "Lockdown", "No outgoing execution, no loosening. Deposits, tightening, recovery and guardians keep working."],
          ].map(([m, name, desc]) => (
            <div key={String(m)} className={vault.mode === m ? "on" : ""}>
              {vault.mode === m && <span className="cur"><Badge tone="brand">Current</Badge></span>}
              <div className="m">{name as string}</div>
              <div className="d">{desc as string}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 20 }} />
        <Field label="Reason (recorded onchain, 31 characters)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="phishing incident" maxLength={31} />
        </Field>
        <div className="inline">
          {vault.mode < Mode.ELEVATED && <Button kind="secondary" disabled={!(roles & (ROLE_OWNER | ROLE_GUARDIAN)) || tx.busy} onClick={() => call("raiseMode", [Mode.ELEVATED, r32])}>Raise to Elevated</Button>}
          {vault.mode < Mode.LOCKDOWN && <Button kind="danger" disabled={!(roles & (ROLE_OWNER | ROLE_GUARDIAN)) || tx.busy} onClick={() => call("raiseMode", [Mode.LOCKDOWN, r32])}>Freeze vault</Button>}
          {vault.mode > Mode.NORMAL && <Button disabled={!(roles & ROLE_OWNER) || tx.busy} onClick={() => call("proposeModeRelax", [vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL])}>Propose lowering to {vault.mode === Mode.LOCKDOWN ? "Elevated" : "Normal"}</Button>}
          {!(roles & (ROLE_OWNER | ROLE_GUARDIAN)) && <span className="caption">Connect an owner or guardian wallet to change the mode.</span>}
        </div>
        <TxStatus state={tx.state} />
      </Section>

      <Section title={<>Guardians<small>An independent control plane. Guardians can freeze, veto, confirm and recover, and can never move funds.</small></>}>
        {guardians.length === 0 ? (
          <div className="notice notice-bad">No guardian configured. Critical transfers cannot be confirmed and nobody independent can veto.</div>
        ) : (
          guardians.map((g) => (
            <div key={g.address} className="member-row">
              <Identicon address={g.address} size={36} />
              <a className="addr" href={`https://explorer.34.60.137.196.sslip.io/address/${g.address}`} target="_blank" rel="noreferrer"><b>ark:</b>{g.address}</a>
              <CopyButton value={g.address} />
              <span className="roles"><Badge tone="warn">Guardian</Badge></span>
            </div>
          ))
        )}
        <dl className="kv" style={{ marginTop: 16 }}>
          <div><dt>Veto</dt><dd>any single guardian, any time before execution</dd></div>
          <div><dt>Critical confirmation</dt><dd>{vault.policy.guardianRequiredCritical ? `${vault.policy.guardianThreshold} of ${guardians.length}` : "not required"}</dd></div>
          <div><dt>Leaving Lockdown</dt><dd>{vault.policy.guardianThreshold} of {guardians.length} plus {vault.policy.governanceThreshold} owner{vault.policy.governanceThreshold === 1 ? "" : "s"}, after {fmtDuration(vault.policy.policyChangeDelay)}</dd></div>
        </dl>
      </Section>

      <Section title={<>Recovery<small>Replace a lost or compromised signer with a new address holding the same roles. Executes after {fmtDuration(vault.policy.recoveryDelay)}; any owner can cancel; the vault moves to Elevated when it completes.</small></>}>
        <div className="row">
          <Field label="Signer to replace">
            <input value={oldSigner} onChange={(e) => setOldSigner(e.target.value.trim())} placeholder="0x…" list="members" />
            <datalist id="members">{vault.members.map((m) => <option key={m.address} value={m.address} />)}</datalist>
          </Field>
          <Field label="New signer"><input value={newSigner} onChange={(e) => setNewSigner(e.target.value.trim())} placeholder="0x…" /></Field>
        </div>
        <div className="inline">
          <Button disabled={!(roles & ROLE_GUARDIAN) || !isAddress(oldSigner) || !isAddress(newSigner) || tx.busy} onClick={() => call("proposeRecovery", [oldSigner as `0x${string}`, newSigner as `0x${string}`])}>Propose recovery</Button>
          {!(roles & ROLE_GUARDIAN) && <span className="caption">Only guardians can start a recovery.</span>}
        </div>
      </Section>

      <Section title={<>Maximum possible loss<small>A conservative upper bound per asset under the stated assumptions. Never a guarantee.</small></>}>
        {vault.assets.map((a) => {
          const l = computeMaxLoss(vault.policy, a.limits, a.balance, vault.mode);
          const share = a.balance > 0n ? Number((l.immediate * 100n) / a.balance) : 0;
          return (
            <div key={a.address} style={{ marginBottom: 20 }}>
              <div className="gauge" style={{ marginBottom: 8 }}>
                <div className="ring" style={{ ["--pct" as string]: Math.min(100, share) }}><span>{share}%</span></div>
                <div>
                  <div className="strong" style={{ fontSize: 16 }}>{fmtAmount(l.immediate, a.decimals, a.symbol)} could leave with no delay</div>
                  <div className="caption">bounded by {l.immediateBinding}</div>
                </div>
              </div>
              <KV rows={[["Could leave within 24h", `${fmtAmount(l.day, a.decimals, a.symbol)} (${l.dayBinding})`], ["Critical withdrawals wait", fmtDuration(l.criticalDelay)], ["High-risk withdrawals wait", fmtDuration(l.highDelay)]]} />
            </div>
          );
        })}
        <ul className="assumptions">{computeMaxLoss(vault.policy, vault.assets[0]?.limits ?? { approved: false, lowMax: 0n, highMax: 0n, perTxMax: 0n, dailyMax: 0n }, 0n, vault.mode).assumptions.map((s) => <li key={s}>{s}</li>)}</ul>
      </Section>

      <Section title={<>Security posture<small>Obvious weaknesses and confirmed controls. Not a measure of absolute security.</small></>}>
        <Posture vault={vault} />
      </Section>

      <Section title={<>Mode history<small>Every change is emitted onchain with its reason.</small></>}>
        {vault.modeHistory.length === 0 ? <p className="desc">No mode changes recorded.</p> : (
          <dl className="kv">
            {[...vault.modeHistory].reverse().map((h, i) => (
              <div key={i}><dt>{MODE_LABEL[h.previous]} → {MODE_LABEL[h.mode]}{h.reason ? ` · ${h.reason}` : ""}</dt><dd><Address value={h.by} /> · <TxLink hash={h.txHash} /></dd></div>
            ))}
          </dl>
        )}
      </Section>
    </>
  );
}

export type PostureItem = { ok: "ok" | "warn" | "bad"; text: string };

export function postureItems(vault: VaultData): PostureItem[] {
  const p = vault.policy;
  const g = vault.counts.guardians;
  return [
    { ok: g > 0 ? "ok" : "bad", text: g > 0 ? `${g} independent guardian${g === 1 ? "" : "s"} configured` : "No guardian: nobody independent can veto or freeze" },
    { ok: p.guardianRequiredCritical ? "ok" : "warn", text: p.guardianRequiredCritical ? "Critical transfers need guardian confirmation" : "Critical transfers do not need a guardian" },
    { ok: p.delayCritical >= 24 * 3600 ? "ok" : "warn", text: `Critical delay ${fmtDuration(p.delayCritical)}` },
    { ok: p.recipientActivationDelay > 0 ? "ok" : "bad", text: p.recipientActivationDelay > 0 ? `New recipients wait ${fmtDuration(p.recipientActivationDelay)}` : "New recipients can be paid immediately" },
    { ok: vault.assets.every((a) => a.limits.dailyMax > 0n) ? "ok" : "warn", text: vault.assets.every((a) => a.limits.dailyMax > 0n) ? "24h outflow cap on every asset" : "Some assets have no 24h cap" },
    { ok: p.envelopeBps > 0 ? "ok" : "warn", text: p.envelopeBps > 0 ? `Circuit breaker at ${p.envelopeBps / 100}% per ${fmtDuration(p.envelopeWindow)}` : "No loss envelope configured" },
    { ok: p.policyChangeDelay > 0 ? "ok" : "bad", text: p.policyChangeDelay > 0 ? `Security-reducing changes wait ${fmtDuration(p.policyChangeDelay)}` : "Policy can be weakened instantly" },
    { ok: p.recoveryDelay > 0 && g > 0 ? "ok" : "warn", text: `Recovery configured (${fmtDuration(p.recoveryDelay)} delay)` },
    { ok: p.approvalsLow >= 2 ? "ok" : "warn", text: p.approvalsLow >= 2 ? "Routine payments need two approvals" : "Routine payments need a single approval" },
  ];
}

export function Posture({ vault, compact = false }: { vault: VaultData; compact?: boolean }) {
  const client = usePublicClient();
  const signers = vault.members.filter((m) => !(m.roles & ROLE_GUARDIAN));
  const { data: codeMap } = useQuery({
    queryKey: ["codes", vault.address, signers.map((s) => s.address).join(",")],
    queryFn: async () => {
      const out: Record<string, boolean> = {};
      await Promise.all(signers.map(async (s) => { const code = await client!.getCode({ address: s.address }).catch(() => undefined); out[s.address.toLowerCase()] = Boolean(code && code !== "0x"); }));
      return out;
    },
    enabled: Boolean(client),
    staleTime: 60_000,
  });
  const eoa = codeMap ? signers.filter((s) => !codeMap[s.address.toLowerCase()]).length : null;
  const items = postureItems(vault);
  if (eoa !== null) items.push({ ok: eoa === 0 ? "ok" : "warn", text: eoa === 0 ? "All signers are smart-contract accounts" : `${eoa} of ${signers.length} signers are externally-owned keys` });
  return (
    <ul className={`posture ${compact ? "small" : ""}`}>
      {items.map((i) => (
        <li key={i.text}><span className={`dot ${i.ok}`} /><span>{i.text}</span></li>
      ))}
    </ul>
  );
}
