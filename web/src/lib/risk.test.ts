import { describe, expect, it } from "vitest";
import { classify, exposureBps, requirements, type RiskInput } from "./risk";
import {
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
} from "./types";

const USD = 1_000_000n;

function base(): RiskInput {
  return {
    amount: 1_000n * USD,
    assetBalance: 1_000_000n * USD,
    lowMax: 5_000n * USD,
    highMax: 25_000n * USD,
    dailyMax: 100_000n * USD,
    daySpent: 0n,
    trust: Trust.VERIFIED,
    inProbation: false,
    mode: Mode.NORMAL,
    highExposureBps: 500,
    criticalExposureBps: 2000,
  };
}

/** Same vectors as contracts/test/SkurRisk.t.sol. */
describe("risk engine mirror", () => {
  it("routine supplier payment is LOW", () => {
    const r = classify(base());
    expect(r).toEqual({ tier: Tier.LOW, reasons: 0, exposureBps: 10 });
  });

  it("amount above lowMax is HIGH", () => {
    const r = classify({ ...base(), amount: 10_000n * USD });
    expect(r.tier).toBe(Tier.HIGH);
    expect(r.reasons).toBe(REASON_AMOUNT_HIGH);
  });

  it("amount above highMax is CRITICAL", () => {
    const r = classify({ ...base(), amount: 30_000n * USD });
    expect(r.tier).toBe(Tier.CRITICAL);
    expect(r.reasons).toBe(REASON_AMOUNT_CRITICAL);
  });

  it("exposure escalates a small treasury", () => {
    const r = classify({ ...base(), assetBalance: 50_000n * USD, amount: 4_000n * USD, dailyMax: 0n });
    expect(r).toEqual({ tier: Tier.HIGH, reasons: REASON_EXPOSURE_HIGH, exposureBps: 800 });
  });

  it("exposure critical", () => {
    const r = classify({ ...base(), assetBalance: 20_000n * USD, amount: 4_000n * USD, dailyMax: 0n });
    expect(r).toEqual({ tier: Tier.CRITICAL, reasons: REASON_EXPOSURE_CRITICAL, exposureBps: 2000 });
  });

  it("new recipient bumps one tier", () => {
    let r = classify({ ...base(), trust: Trust.NEW, inProbation: true });
    expect(r.tier).toBe(Tier.HIGH);
    expect(r.reasons).toBe(REASON_RECIPIENT_PROBATION);
    r = classify({ ...base(), trust: Trust.NEW, inProbation: true, amount: 10_000n * USD });
    expect(r.tier).toBe(Tier.CRITICAL);
    expect(r.reasons).toBe(REASON_AMOUNT_HIGH | REASON_RECIPIENT_PROBATION);
  });

  it("unknown recipient treated as probation", () => {
    const r = classify({ ...base(), trust: Trust.UNKNOWN });
    expect(r.tier).toBe(Tier.HIGH);
    expect(r.reasons).toBe(REASON_RECIPIENT_UNKNOWN | REASON_RECIPIENT_PROBATION);
  });

  it("activated new recipient is normal", () => {
    const r = classify({ ...base(), trust: Trust.NEW, inProbation: false });
    expect(r).toMatchObject({ tier: Tier.LOW, reasons: 0 });
  });

  it("restricted recipient always critical", () => {
    const r = classify({ ...base(), trust: Trust.RESTRICTED });
    expect(r).toMatchObject({ tier: Tier.CRITICAL, reasons: REASON_RECIPIENT_RESTRICTED });
  });

  it("velocity pressure", () => {
    const r = classify({ ...base(), daySpent: 49_500n * USD });
    expect(r).toMatchObject({ tier: Tier.HIGH, reasons: REASON_VELOCITY_PRESSURE });
  });

  it("elevated mode bumps", () => {
    const r = classify({ ...base(), mode: Mode.ELEVATED });
    expect(r).toMatchObject({ tier: Tier.HIGH, reasons: REASON_MODE_ELEVATED });
  });

  it("worst case stacks", () => {
    const r = classify({
      ...base(),
      amount: 30_000n * USD,
      assetBalance: 100_000n * USD,
      trust: Trust.UNKNOWN,
      mode: Mode.ELEVATED,
    });
    expect(r.tier).toBe(Tier.CRITICAL);
    expect(r.exposureBps).toBe(3000);
    expect(r.reasons).toBe(
      REASON_AMOUNT_CRITICAL |
        REASON_EXPOSURE_CRITICAL |
        REASON_RECIPIENT_UNKNOWN |
        REASON_RECIPIENT_PROBATION |
        REASON_MODE_ELEVATED,
    );
  });

  it("exposure edges", () => {
    expect(exposureBps(0n, 100n)).toBe(0);
    expect(exposureBps(1n, 0n)).toBe(10_000);
    expect(exposureBps(100n, 100n)).toBe(10_000);
    expect(exposureBps(150n, 100n)).toBe(10_000);
    expect(exposureBps(1n, 100n)).toBe(100);
    expect(exposureBps(1n, 30_000n)).toBe(0);
  });

  it("requirements per tier", () => {
    const p = {
      approvalsLow: 1,
      approvalsHigh: 2,
      approvalsCritical: 3,
      governanceThreshold: 2,
      guardianThreshold: 2,
      guardianRequiredCritical: true,
      delayHigh: 21600,
      delayCritical: 86400,
      recipientActivationDelay: 0,
      policyChangeDelay: 0,
      recoveryDelay: 0,
      proposalTtl: 0,
      highExposureBps: 0,
      criticalExposureBps: 0,
      hardBlockExposureBps: 0,
      envelopeBps: 0,
      envelopeWindow: 0,
    };
    expect(requirements(p, Tier.LOW)).toEqual({ approvals: 1, guardians: 0, delay: 0 });
    expect(requirements(p, Tier.HIGH)).toEqual({ approvals: 2, guardians: 0, delay: 21600 });
    expect(requirements(p, Tier.CRITICAL)).toEqual({ approvals: 3, guardians: 2, delay: 86400 });
    expect(requirements({ ...p, guardianRequiredCritical: false }, Tier.CRITICAL).guardians).toBe(0);
  });
});
