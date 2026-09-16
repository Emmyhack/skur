import { fmtDuration } from "./format";
import type { VaultData } from "./vaultReads";

/** Plain-language posture checks shared by the web and mobile interfaces. */
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

