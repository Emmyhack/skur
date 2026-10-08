import { describe, expect, it } from 'vitest';
import {
  classify,
  computeMaxLoss,
  effectiveCaps,
  exposureBps,
  fmtDuration,
  limitReductions,
  parseAmount,
  policyReductions,
  postureItems,
  requirements,
  runScenarios,
  TEMPLATES,
  trustReduces,
  validateCounts,
  validateLimits,
  validatePolicy,
  validatePolicyCode,
} from '../src/engine';
import { DAY, HOUR, Mode, Reason, Tier, Trust, type Policy } from '../src/types';

/**
 * These are the same vectors as `sui/tests/engine_tests.move`. Both suites have to agree, because
 * the only thing worse than a wrong tier is two components disagreeing about it.
 */
const base: Policy = {
  approvalsLow: 1,
  approvalsHigh: 2,
  approvalsCritical: 3,
  governanceThreshold: 2,
  guardianThreshold: 1,
  guardianRequiredCritical: true,
  delayHigh: HOUR,
  delayCritical: DAY,
  recipientActivationDelay: 12 * HOUR,
  policyChangeDelay: 2 * DAY,
  recoveryDelay: 3 * DAY,
  proposalTtl: 30 * DAY,
  highExposureBps: 1_000,
  criticalExposureBps: 2_500,
  hardBlockExposureBps: 9_000,
  envelopeBps: 3_000,
  envelopeWindow: DAY,
};

const input = (
  amount: bigint,
  balance: bigint,
  trust: Trust,
  probation = false,
  mode: Mode = Mode.NORMAL,
) => ({
  amount,
  assetBalance: balance,
  lowMax: 1_000n,
  highMax: 10_000n,
  dailyMax: 0n,
  daySpent: 0n,
  trust,
  inProbation: probation,
  mode,
  highExposureBps: 1_000,
  criticalExposureBps: 2_500,
});

describe('policy validation', () => {
  it('accepts the base policy', () => {
    expect(validatePolicyCode(base)).toBe(0);
    expect(validatePolicy(base)).toEqual([]);
  });

  it('returns the same code the contract aborts with', () => {
    expect(validatePolicyCode({ ...base, approvalsLow: 0 })).toBe(1);
    expect(validatePolicyCode({ ...base, approvalsHigh: 0, approvalsLow: 1 })).toBe(2);
    expect(validatePolicyCode({ ...base, approvalsCritical: 1 })).toBe(3);
    expect(validatePolicyCode({ ...base, governanceThreshold: 0 })).toBe(4);
    expect(validatePolicyCode({ ...base, guardianThreshold: 0 })).toBe(5);
    expect(validatePolicyCode({ ...base, delayCritical: 0 })).toBe(6);
    expect(validatePolicyCode({ ...base, highExposureBps: 3_000 })).toBe(7);
    expect(validatePolicyCode({ ...base, hardBlockExposureBps: 2_000 })).toBe(9);
    expect(validatePolicyCode({ ...base, envelopeWindow: 60_000 })).toBe(12);
    expect(validatePolicyCode({ ...base, proposalTtl: DAY })).toBe(13);
  });

  it('requires the lifetime to clear the longest delay by an hour', () => {
    const p = { ...base, delayCritical: DAY, policyChangeDelay: 0, recoveryDelay: 0, recipientActivationDelay: 0 };
    expect(validatePolicyCode({ ...p, proposalTtl: DAY + HOUR })).toBe(0);
    expect(validatePolicyCode({ ...p, proposalTtl: DAY + HOUR - 1 })).toBe(13);
  });

  it('checks the roster against the policy', () => {
    expect(validateCounts(base, 2, 3, 1, 1)).toEqual([]);
    expect(validateCounts(base, 0, 3, 1, 1)).toHaveLength(2); // no owner, and below threshold
    expect(validateCounts(base, 2, 3, 0, 1)).toHaveLength(1);
    expect(validateCounts(base, 2, 2, 1, 1)).toHaveLength(1);
    expect(validateCounts(base, 2, 3, 1, 0)).toHaveLength(1);
  });

  it('checks limits for coherence, treating zero as no cap', () => {
    expect(validateLimits({ approved: true, lowMax: 10n, highMax: 5n, perTxMax: 0n, dailyMax: 0n })).toHaveLength(1);
    expect(validateLimits({ approved: true, lowMax: 1n, highMax: 5n, perTxMax: 100n, dailyMax: 50n })).toHaveLength(1);
    expect(validateLimits({ approved: true, lowMax: 1n, highMax: 5n, perTxMax: 100n, dailyMax: 0n })).toEqual([]);
  });
});

describe('what counts as weakening', () => {
  it('reports nothing for a change that only tightens', () => {
    expect(
      policyReductions(base, {
        ...base,
        approvalsLow: 2,
        delayHigh: 2 * HOUR,
        highExposureBps: 500,
        envelopeBps: 2_000,
      }),
    ).toEqual([]);
  });

  it('catches fewer approvals', () => {
    expect(policyReductions(base, { ...base, approvalsHigh: 1 })).toHaveLength(1);
  });

  it('catches dropping the guardian requirement', () => {
    expect(policyReductions(base, { ...base, guardianRequiredCritical: false })).toEqual([
      'no guardian required for critical payments',
    ]);
  });

  it('treats disabling a threshold as the loosest move, not the tightest', () => {
    expect(policyReductions(base, { ...base, envelopeBps: 0 })).toEqual(['a larger loss envelope']);
    expect(policyReductions(base, { ...base, hardBlockExposureBps: 0 })).toEqual([
      'a weaker exposure hard block',
    ]);
  });

  it('treats a longer proposal lifetime as weakening', () => {
    expect(policyReductions(base, { ...base, proposalTtl: 60 * DAY })).toEqual([
      'a longer proposal lifetime',
    ]);
  });

  it('catches weakened caps and newly approved assets', () => {
    const a = { approved: true, lowMax: 100n, highMax: 1_000n, perTxMax: 500n, dailyMax: 5_000n };
    expect(limitReductions(a, { ...a, perTxMax: 0n })).toEqual(['a weaker per-transaction cap']);
    expect(limitReductions(a, { ...a, perTxMax: 400n })).toEqual([]);
    expect(limitReductions({ ...a, approved: false }, a)).toContain('approving a new asset');
  });

  it('treats lifting a restriction as weakening and imposing one as not', () => {
    expect(trustReduces(Trust.RESTRICTED, Trust.VERIFIED)).toBe(true);
    expect(trustReduces(Trust.NEW, Trust.TRUSTED)).toBe(true);
    expect(trustReduces(Trust.TRUSTED, Trust.BLOCKED)).toBe(false);
    expect(trustReduces(Trust.VERIFIED, Trust.NEW)).toBe(false);
  });
});

describe('risk classification', () => {
  it('computes exposure as a share of holdings', () => {
    expect(exposureBps(0n, 1_000n)).toBe(0);
    expect(exposureBps(100n, 1_000n)).toBe(1_000);
    expect(exposureBps(1_000n, 1_000n)).toBe(10_000);
    expect(exposureBps(1_500n, 1_000n)).toBe(10_000);
    expect(exposureBps(5n, 0n)).toBe(10_000);
  });

  it('survives a treasury large enough to overflow 64-bit intermediate maths', () => {
    const big = 1_000_000_000_000_000_000n;
    expect(exposureBps(big / 4n, big)).toBe(2_500);
  });

  it('escalates on amount', () => {
    expect(classify(input(500n, 1_000_000n, Trust.VERIFIED)).tier).toBe(Tier.LOW);
    expect(classify(input(5_000n, 1_000_000n, Trust.VERIFIED)).tier).toBe(Tier.HIGH);
    expect(classify(input(50_000n, 10_000_000n, Trust.VERIFIED)).tier).toBe(Tier.CRITICAL);
  });

  it('escalates on share of the treasury alone', () => {
    const o = classify(input(500n, 4_000n, Trust.VERIFIED));
    expect(o.tier).toBe(Tier.HIGH);
    expect(o.reasons & Reason.EXPOSURE_HIGH).toBeTruthy();
    expect(classify(input(900n, 3_000n, Trust.VERIFIED)).tier).toBe(Tier.CRITICAL);
  });

  it('escalates an address the vault has never paid', () => {
    const o = classify(input(500n, 1_000_000n, Trust.UNKNOWN));
    expect(o.tier).toBe(Tier.HIGH);
    expect(o.reasons & Reason.RECIPIENT_UNKNOWN).toBeTruthy();
    expect(classify(input(5_000n, 1_000_000n, Trust.UNKNOWN)).tier).toBe(Tier.CRITICAL);
  });

  it('escalates during probation and stops afterwards', () => {
    expect(classify(input(500n, 1_000_000n, Trust.NEW, true)).tier).toBe(Tier.HIGH);
    expect(classify(input(500n, 1_000_000n, Trust.NEW, false)).tier).toBe(Tier.LOW);
  });

  it('makes a restricted recipient critical at any amount', () => {
    expect(classify(input(1n, 1_000_000_000n, Trust.RESTRICTED)).tier).toBe(Tier.CRITICAL);
  });

  it('escalates halfway through the day rather than at the end', () => {
    const quiet = { ...input(100n, 1_000_000n, Trust.VERIFIED), dailyMax: 10_000n, daySpent: 0n };
    expect(classify(quiet).tier).toBe(Tier.LOW);
    const pressured = { ...quiet, daySpent: 5_000n };
    const o = classify(pressured);
    expect(o.tier).toBe(Tier.HIGH);
    expect(o.reasons & Reason.VELOCITY_PRESSURE).toBeTruthy();
  });

  it('escalates everything in Elevated mode', () => {
    expect(classify(input(500n, 1_000_000n, Trust.VERIFIED, false, Mode.ELEVATED)).tier).toBe(Tier.HIGH);
    expect(classify(input(5_000n, 1_000_000n, Trust.VERIFIED, false, Mode.ELEVATED)).tier).toBe(Tier.CRITICAL);
  });

  it('records every reason, not only the loudest', () => {
    const o = classify({
      ...input(5_000n, 20_000n, Trust.UNKNOWN, true, Mode.ELEVATED),
      dailyMax: 10_000n,
      daySpent: 6_000n,
    });
    expect(o.tier).toBe(Tier.CRITICAL);
    for (const bit of [
      Reason.AMOUNT_HIGH,
      Reason.EXPOSURE_CRITICAL,
      Reason.RECIPIENT_UNKNOWN,
      Reason.VELOCITY_PRESSURE,
      Reason.MODE_ELEVATED,
    ]) {
      expect(o.reasons & bit).toBeTruthy();
    }
  });

  it('maps a tier to its requirements', () => {
    expect(requirements(base, Tier.LOW)).toEqual({ approvals: 1, guardians: 0, delay: 0 });
    expect(requirements(base, Tier.HIGH)).toEqual({ approvals: 2, guardians: 0, delay: HOUR });
    expect(requirements(base, Tier.CRITICAL)).toEqual({ approvals: 3, guardians: 1, delay: DAY });
  });

  it('halves the caps in Elevated but never to zero, and leaves "no cap" alone', () => {
    expect(effectiveCaps(1_000n, 10_000n, Mode.ELEVATED)).toEqual({ perTxMax: 500n, dailyMax: 5_000n });
    expect(effectiveCaps(1n, 1n, Mode.ELEVATED)).toEqual({ perTxMax: 1n, dailyMax: 1n });
    expect(effectiveCaps(0n, 0n, Mode.ELEVATED)).toEqual({ perTxMax: 0n, dailyMax: 0n });
    expect(effectiveCaps(1_000n, 10_000n, Mode.NORMAL)).toEqual({ perTxMax: 1_000n, dailyMax: 10_000n });
  });
});

describe('templates', () => {
  it('ships only valid policies', () => {
    for (const t of TEMPLATES) {
      expect(validatePolicy(t.policy), t.name).toEqual([]);
      expect(validateLimits(t.stable), t.name).toEqual([]);
      expect(validateLimits(t.native), t.name).toEqual([]);
    }
  });

  it('ships rosters each template can actually satisfy', () => {
    for (const t of TEMPLATES) {
      expect(
        validateCounts(t.policy, t.minSigners, t.minSigners, t.minSigners, t.minGuardians),
        t.name,
      ).toEqual([]);
    }
  });

  it('covers every kind of organization the product is for', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'startup',
      'team',
      'protocol',
      'fund',
      'payments',
      'nonprofit',
      'familyOffice',
    ]);
  });
});

describe('maximum loss', () => {
  const limits = { approved: true, lowMax: 5_000n, highMax: 25_000n, perTxMax: 0n, dailyMax: 100_000n };

  it('is bounded by the tightest cumulative control', () => {
    const r = computeMaxLoss(base, limits, 1_000_000n, Mode.NORMAL);
    // The envelope is 30% of 1,000,000 = 300,000, so the 100,000 daily cap binds first.
    expect(r.immediate).toBe(100_000n);
    expect(r.immediateBinding).toBe('the daily cap');
  });

  it('is zero in Lockdown', () => {
    const r = computeMaxLoss(base, limits, 1_000_000n, Mode.LOCKDOWN);
    expect(r.immediate).toBe(0n);
    expect(r.day).toBe(0n);
  });

  it('always states its assumptions', () => {
    expect(computeMaxLoss(base, limits, 1_000_000n, Mode.NORMAL).assumptions.length).toBeGreaterThan(3);
  });
});

describe('the simulator', () => {
  const ctx = {
    policy: base,
    limits: { approved: true, lowMax: 5_000_000_000n, highMax: 25_000_000_000n, perTxMax: 0n, dailyMax: 100_000_000_000n },
    balance: 1_000_000_000_000n,
    decimals: 6,
    symbol: 'USDC',
    approverCount: 4,
    guardianCount: 2,
  };

  it('stops one compromised signer paying a new address', () => {
    const r = runScenarios(ctx).find((s) => s.id === 'single-signer-new-address')!;
    expect(r.verdict).toBe('blocked');
  });

  it('calls a compromised guardian impossible, because it holds no spend path', () => {
    const r = runScenarios(ctx).find((s) => s.id === 'guardian-compromised')!;
    expect(r.verdict).toBe('impossible');
  });

  it('stops a split drain on the cumulative controls', () => {
    const r = runScenarios(ctx).find((s) => s.id === 'split-drain')!;
    expect(r.verdict).toBe('blocked');
    expect(r.detail.join(' ')).toMatch(/envelope|daily cap/);
  });

  it('warns when nothing cumulative is configured', () => {
    const open = {
      ...ctx,
      policy: { ...base, envelopeBps: 0 },
      limits: { ...ctx.limits, dailyMax: 0n },
    };
    const r = runScenarios(open).find((s) => s.id === 'split-drain')!;
    expect(r.verdict).toBe('allowed');
    expect(r.detail.join(' ')).toMatch(/Set a daily cap or a loss envelope/);
  });

  it('shows a compromised agent cannot pay itself', () => {
    const r = runScenarios(ctx).find((s) => s.id === 'agent-compromised')!;
    expect(r.verdict).toBe('blocked');
  });
});

describe('posture', () => {
  it('flags a vault with no guardian as bad, not merely a warning', () => {
    const items = postureItems({ policy: base, guardians: 0, assets: [] });
    expect(items[0].ok).toBe('bad');
  });

  it('flags an instantly weakenable policy', () => {
    const items = postureItems({ policy: { ...base, policyChangeDelay: 0 }, guardians: 1, assets: [] });
    expect(items.some((i) => i.ok === 'bad' && /weakened immediately/.test(i.text))).toBe(true);
  });
});

describe('formatting', () => {
  it('renders durations from milliseconds', () => {
    expect(fmtDuration(0)).toBe('none');
    expect(fmtDuration(HOUR)).toBe('1h');
    expect(fmtDuration(DAY + 6 * HOUR)).toBe('1d 6h');
    expect(fmtDuration(90 * 60_000)).toBe('1h 30m');
  });

  it('parses amounts without losing precision', () => {
    expect(parseAmount('1.5', 9)).toBe(1_500_000_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
    expect(parseAmount('1,000', 6)).toBe(1_000_000_000n);
    expect(parseAmount('1.0000001', 6)).toBeNull();
    expect(parseAmount('abc', 6)).toBeNull();
  });
});
