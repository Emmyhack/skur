import type { AssetLimits, Policy } from "./types";

/** Mirror of contracts/src/SkurPolicyLib.sol. The contract decides; this only previews. */
const MIN_EXECUTION_WINDOW = 3600;
const BPS = 10_000;

export function validatePolicy(p: Policy): string[] {
  const errs: string[] = [];
  if (p.approvalsLow === 0) errs.push("Low-tier approvals must be at least 1.");
  if (p.approvalsHigh < p.approvalsLow) errs.push("High-tier approvals cannot be lower than low-tier approvals.");
  if (p.approvalsCritical < p.approvalsHigh) errs.push("Critical-tier approvals cannot be lower than high-tier approvals.");
  if (p.governanceThreshold === 0) errs.push("Governance threshold must be at least 1.");
  if (p.guardianRequiredCritical && p.guardianThreshold === 0) errs.push("Guardian confirmation is required but the guardian threshold is 0.");
  if (p.delayCritical < p.delayHigh) errs.push("Critical delay cannot be shorter than high delay.");
  if (p.criticalExposureBps !== 0 && p.highExposureBps > p.criticalExposureBps) errs.push("High exposure threshold must not exceed the critical one.");
  if (p.criticalExposureBps > BPS || p.highExposureBps > BPS) errs.push("Exposure thresholds must be at most 100%.");
  if (p.hardBlockExposureBps !== 0 && p.hardBlockExposureBps < p.criticalExposureBps) errs.push("Hard block must not be below the critical exposure threshold.");
  if (p.hardBlockExposureBps > BPS) errs.push("Hard block must be at most 100%.");
  if (p.envelopeBps > BPS) errs.push("Envelope must be at most 100%.");
  if (p.envelopeBps !== 0 && p.envelopeWindow < MIN_EXECUTION_WINDOW) errs.push("Envelope window must be at least one hour.");
  const longest = Math.max(p.delayCritical, p.policyChangeDelay, p.recoveryDelay, p.recipientActivationDelay);
  if (p.proposalTtl < longest + MIN_EXECUTION_WINDOW) errs.push("Proposal lifetime must exceed the longest delay by at least one hour.");
  return errs;
}

export function validateLimits(l: AssetLimits): string[] {
  const errs: string[] = [];
  if (l.lowMax > l.highMax) errs.push("Routine maximum cannot exceed the high maximum.");
  if (l.perTxMax !== 0n && l.dailyMax !== 0n && l.perTxMax > l.dailyMax) errs.push("Per-transaction cap cannot exceed the daily cap.");
  return errs;
}

export function validateCounts(p: Policy, owners: number, approvers: number, executors: number, guardians: number): string[] {
  const errs: string[] = [];
  if (owners < 1) errs.push("At least one owner is required.");
  if (executors < 1) errs.push("At least one executor is required.");
  if (owners < p.governanceThreshold) errs.push(`Governance threshold (${p.governanceThreshold}) exceeds the number of owners (${owners}).`);
  if (approvers < p.approvalsCritical) errs.push(`Critical approvals (${p.approvalsCritical}) exceed the number of approvers (${approvers}).`);
  if (guardians < p.guardianThreshold) errs.push(`Guardian threshold (${p.guardianThreshold}) exceeds the number of guardians (${guardians}).`);
  return errs;
}

function thresholdLoosens(a: number, b: number): boolean {
  if (a === 0) return false;
  if (b === 0) return true;
  return b > a;
}

function capLoosens(a: bigint, b: bigint): boolean {
  if (a === 0n) return false;
  if (b === 0n) return true;
  return b > a;
}

/** Returns the list of fields that weaken security (empty means the change is tightening-only). */
export function policyReductions(a: Policy, b: Policy): string[] {
  const out: string[] = [];
  if (b.approvalsLow < a.approvalsLow) out.push("fewer approvals for routine transfers");
  if (b.approvalsHigh < a.approvalsHigh) out.push("fewer approvals for high-risk transfers");
  if (b.approvalsCritical < a.approvalsCritical) out.push("fewer approvals for critical transfers");
  if (b.governanceThreshold < a.governanceThreshold) out.push("lower governance threshold");
  if (b.guardianThreshold < a.guardianThreshold) out.push("fewer guardian confirmations");
  if (a.guardianRequiredCritical && !b.guardianRequiredCritical) out.push("guardian no longer required for critical transfers");
  if (b.delayHigh < a.delayHigh) out.push("shorter high-risk delay");
  if (b.delayCritical < a.delayCritical) out.push("shorter critical delay");
  if (b.recipientActivationDelay < a.recipientActivationDelay) out.push("shorter new-recipient delay");
  if (b.policyChangeDelay < a.policyChangeDelay) out.push("shorter policy-change delay");
  if (b.recoveryDelay < a.recoveryDelay) out.push("shorter recovery delay");
  if (b.proposalTtl > a.proposalTtl) out.push("longer proposal lifetime");
  if (thresholdLoosens(a.highExposureBps, b.highExposureBps)) out.push("higher exposure threshold for escalation");
  if (thresholdLoosens(a.criticalExposureBps, b.criticalExposureBps)) out.push("higher exposure threshold for critical");
  if (thresholdLoosens(a.hardBlockExposureBps, b.hardBlockExposureBps)) out.push("weaker exposure hard block");
  if (thresholdLoosens(a.envelopeBps, b.envelopeBps)) out.push("larger loss envelope");
  if (a.envelopeBps !== 0 && b.envelopeWindow < a.envelopeWindow) out.push("shorter envelope window");
  return out;
}

export function limitReductions(a: AssetLimits, b: AssetLimits): string[] {
  const out: string[] = [];
  if (!a.approved && b.approved) out.push("approving a new asset");
  if (b.lowMax > a.lowMax) out.push("higher routine maximum");
  if (b.highMax > a.highMax) out.push("higher high-tier maximum");
  if (capLoosens(a.perTxMax, b.perTxMax)) out.push("weaker per-transaction cap");
  if (capLoosens(a.dailyMax, b.dailyMax)) out.push("weaker daily cap");
  return out;
}

export function policyToContract(p: Policy) {
  return {
    approvalsLow: p.approvalsLow,
    approvalsHigh: p.approvalsHigh,
    approvalsCritical: p.approvalsCritical,
    governanceThreshold: p.governanceThreshold,
    guardianThreshold: p.guardianThreshold,
    guardianRequiredCritical: p.guardianRequiredCritical,
    delayHigh: p.delayHigh,
    delayCritical: p.delayCritical,
    recipientActivationDelay: p.recipientActivationDelay,
    policyChangeDelay: p.policyChangeDelay,
    recoveryDelay: p.recoveryDelay,
    proposalTtl: p.proposalTtl,
    highExposureBps: p.highExposureBps,
    criticalExposureBps: p.criticalExposureBps,
    hardBlockExposureBps: p.hardBlockExposureBps,
    envelopeBps: p.envelopeBps,
    envelopeWindow: p.envelopeWindow,
  } as const;
}

export function policyFromContract(raw: Record<string, unknown>): Policy {
  const n = (k: string) => Number(raw[k] ?? 0);
  return {
    approvalsLow: n("approvalsLow"),
    approvalsHigh: n("approvalsHigh"),
    approvalsCritical: n("approvalsCritical"),
    governanceThreshold: n("governanceThreshold"),
    guardianThreshold: n("guardianThreshold"),
    guardianRequiredCritical: Boolean(raw.guardianRequiredCritical),
    delayHigh: n("delayHigh"),
    delayCritical: n("delayCritical"),
    recipientActivationDelay: n("recipientActivationDelay"),
    policyChangeDelay: n("policyChangeDelay"),
    recoveryDelay: n("recoveryDelay"),
    proposalTtl: n("proposalTtl"),
    highExposureBps: n("highExposureBps"),
    criticalExposureBps: n("criticalExposureBps"),
    hardBlockExposureBps: n("hardBlockExposureBps"),
    envelopeBps: n("envelopeBps"),
    envelopeWindow: n("envelopeWindow"),
  };
}
