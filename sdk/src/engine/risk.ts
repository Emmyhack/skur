import { BPS, Mode, Reason, Tier, Trust, type Policy } from '../types.js';

/**
 * Mirror of `sui/sources/risk.move`. Used to preview a transfer against a policy that is not
 * deployed yet, and to drive the simulator.
 *
 * For a live vault, prefer `previewTransfer` from `../vault`, which simulates the chain's own
 * `preview_transfer` so the answer is the contract's and not this file's. These vectors are pinned
 * against the Move tests in `sui/tests/engine_tests.move`.
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
  let tier: Tier = Tier.LOW;
  let reasons = 0;

  if (i.amount > i.highMax) {
    tier = Tier.CRITICAL;
    reasons |= Reason.AMOUNT_CRITICAL;
  } else if (i.amount > i.lowMax) {
    tier = Tier.HIGH;
    reasons |= Reason.AMOUNT_HIGH;
  }

  const exposure = exposureBps(i.amount, i.assetBalance);
  if (i.criticalExposureBps !== 0 && exposure >= i.criticalExposureBps) {
    tier = Tier.CRITICAL;
    reasons |= Reason.EXPOSURE_CRITICAL;
  } else if (i.highExposureBps !== 0 && exposure >= i.highExposureBps) {
    tier = atLeast(tier, Tier.HIGH);
    reasons |= Reason.EXPOSURE_HIGH;
  }

  if (i.trust === Trust.RESTRICTED) {
    tier = Tier.CRITICAL;
    reasons |= Reason.RECIPIENT_RESTRICTED;
  } else if (i.trust === Trust.UNKNOWN) {
    tier = bump(tier);
    reasons |= Reason.RECIPIENT_UNKNOWN | Reason.RECIPIENT_PROBATION;
  } else if (i.trust === Trust.NEW && i.inProbation) {
    tier = bump(tier);
    reasons |= Reason.RECIPIENT_PROBATION;
  }

  if (i.dailyMax !== 0n && (i.daySpent + i.amount) * 2n > i.dailyMax) {
    tier = atLeast(tier, Tier.HIGH);
    reasons |= Reason.VELOCITY_PRESSURE;
  }

  if (i.mode === Mode.ELEVATED) {
    tier = bump(tier);
    reasons |= Reason.MODE_ELEVATED;
  }

  return { tier, reasons, exposureBps: exposure };
}

export function requirements(
  p: Policy,
  tier: Tier,
): { approvals: number; guardians: number; delay: number } {
  if (tier === Tier.LOW) return { approvals: p.approvalsLow, guardians: 0, delay: 0 };
  if (tier === Tier.HIGH) return { approvals: p.approvalsHigh, guardians: 0, delay: p.delayHigh };
  return {
    approvals: p.approvalsCritical,
    guardians: p.guardianRequiredCritical ? p.guardianThreshold : 0,
    delay: p.delayCritical,
  };
}

/** Elevated halves the caps, floored at one unit. No cap stays no cap. */
export function effectiveCaps(
  perTxMax: bigint,
  dailyMax: bigint,
  mode: Mode,
): { perTxMax: bigint; dailyMax: bigint } {
  if (mode !== Mode.ELEVATED) return { perTxMax, dailyMax };
  const half = (x: bigint) => (x === 0n ? 0n : x / 2n === 0n ? 1n : x / 2n);
  return { perTxMax: half(perTxMax), dailyMax: half(dailyMax) };
}
