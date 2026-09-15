import {
  BPS,
  Mode,
  REASON_AMOUNT_CRITICAL,
  REASON_AMOUNT_HIGH,
  REASON_EXPOSURE_CRITICAL,
  REASON_EXPOSURE_HIGH,
  REASON_MODE_ELEVATED,
  REASON_RECIPIENT_PROBATION,
  REASON_RECIPIENT_RESTRICTED,
  REASON_RECIPIENT_UNKNOWN,
  REASON_VELOCITY_PRESSURE,
  Tier,
  Trust,
  type Policy,
} from "./types";

/**
 * TypeScript mirror of contracts/src/SkurRisk.sol.
 * Used only for the policy simulator and for previewing policies that are not deployed yet.
 * For a live vault the interface calls `previewTransfer` on the contract, which is authoritative.
 * test/SkurRisk.t.sol and risk.test.ts pin the same vectors.
 */
export type RiskInput = {
  amount: bigint;
  assetBalance: bigint;
  lowMax: bigint;
  highMax: bigint;
  dailyMax: bigint;
  daySpent: bigint;
  trust: Trust;
  inProbation: boolean;
  mode: Mode;
  highExposureBps: number;
  criticalExposureBps: number;
};

export type RiskOutput = { tier: Tier; reasons: number; exposureBps: number };

export function exposureBps(amount: bigint, balance: bigint): number {
  if (amount === 0n) return 0;
  if (balance === 0n || amount >= balance) return Number(BPS);
  return Number((amount * BPS) / balance);
}

function bump(t: Tier): Tier {
  return t === Tier.LOW ? Tier.HIGH : Tier.CRITICAL;
}

function atLeast(t: Tier, floor: Tier): Tier {
  return t >= floor ? t : floor;
}

export function classify(i: RiskInput): RiskOutput {
  let tier = Tier.LOW;
  let reasons = 0;

  if (i.amount > i.highMax) {
    tier = Tier.CRITICAL;
    reasons |= REASON_AMOUNT_CRITICAL;
  } else if (i.amount > i.lowMax) {
    tier = Tier.HIGH;
    reasons |= REASON_AMOUNT_HIGH;
  }

  const exposure = exposureBps(i.amount, i.assetBalance);
  if (i.criticalExposureBps !== 0 && exposure >= i.criticalExposureBps) {
    tier = Tier.CRITICAL;
    reasons |= REASON_EXPOSURE_CRITICAL;
  } else if (i.highExposureBps !== 0 && exposure >= i.highExposureBps) {
    tier = atLeast(tier, Tier.HIGH);
    reasons |= REASON_EXPOSURE_HIGH;
  }

  if (i.trust === Trust.RESTRICTED) {
    tier = Tier.CRITICAL;
    reasons |= REASON_RECIPIENT_RESTRICTED;
  } else if (i.trust === Trust.UNKNOWN) {
    tier = bump(tier);
    reasons |= REASON_RECIPIENT_UNKNOWN | REASON_RECIPIENT_PROBATION;
  } else if (i.trust === Trust.NEW && i.inProbation) {
    tier = bump(tier);
    reasons |= REASON_RECIPIENT_PROBATION;
  }

  if (i.dailyMax !== 0n && (i.daySpent + i.amount) * 2n > i.dailyMax) {
    tier = atLeast(tier, Tier.HIGH);
    reasons |= REASON_VELOCITY_PRESSURE;
  }

  if (i.mode === Mode.ELEVATED) {
    tier = bump(tier);
    reasons |= REASON_MODE_ELEVATED;
  }

  return { tier, reasons, exposureBps: exposure };
}

export function requirements(p: Policy, tier: Tier): { approvals: number; guardians: number; delay: number } {
  if (tier === Tier.LOW) return { approvals: p.approvalsLow, guardians: 0, delay: 0 };
  if (tier === Tier.HIGH) return { approvals: p.approvalsHigh, guardians: 0, delay: p.delayHigh };
  return {
    approvals: p.approvalsCritical,
    guardians: p.guardianRequiredCritical ? p.guardianThreshold : 0,
    delay: p.delayCritical,
  };
}

/** Effective caps under the current mode (Elevated halves them, floored at 1 unit). */
export function effectiveCaps(perTxMax: bigint, dailyMax: bigint, mode: Mode): { perTxMax: bigint; dailyMax: bigint } {
  if (mode !== Mode.ELEVATED) return { perTxMax, dailyMax };
  const half = (x: bigint) => (x === 0n ? 0n : x / 2n === 0n ? 1n : x / 2n);
  return { perTxMax: half(perTxMax), dailyMax: half(dailyMax) };
}
