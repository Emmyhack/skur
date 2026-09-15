import { Mode, Tier, type AssetLimits, type Policy } from "./types";
import { effectiveCaps } from "./risk";

/**
 * Maximum possible loss, per asset, translated from a policy into numbers a finance team understands.
 * Conservative by construction: it assumes every signer needed for a tier is compromised and that the
 * attacker chooses amounts optimally. It is an upper bound under the stated assumptions, never a guarantee.
 */
export type MaxLoss = {
  /** Largest amount that can leave without any delay (LOW-tier transfers, repeated until a cap binds). */
  immediate: bigint;
  /** Amount that can leave within 24h if only approvers are compromised and no guardian acts. */
  day: bigint;
  /** Seconds a CRITICAL transfer must wait, i.e. how long guardians have to veto the largest transfers. */
  criticalDelay: number;
  highDelay: number;
  /** Which control produced each number. */
  immediateBinding: string;
  dayBinding: string;
  assumptions: string[];
};

export function computeMaxLoss(policy: Policy, limits: AssetLimits, balance: bigint, mode: Mode): MaxLoss {
  const caps = effectiveCaps(limits.perTxMax, limits.dailyMax, mode);
  const assumptions = [
    "Enough approvers to satisfy each tier are compromised and cooperate.",
    "Executors are compromised or collude.",
    "No guardian vetoes or freezes during the delay windows.",
    "Recipients used by the attacker are already activated (not in probation).",
    "Limits are per asset; each asset has its own envelope and caps.",
  ];

  // --- immediate: LOW-tier transfers need no delay. Each is at most lowMax (or exposure-bounded).
  // An attacker repeats them until the daily cap or envelope binds. In Elevated mode LOW is impossible.
  let immediate = 0n;
  let immediateBinding = "no undelayed tier";
  if (mode === Mode.NORMAL) {
    const exposureLow = policy.highExposureBps === 0 ? balance : (balance * BigInt(policy.highExposureBps - 1)) / 10_000n;
    const perTransfer = min(limits.lowMax, caps.perTxMax || limits.lowMax, exposureLow);
    if (perTransfer > 0n) {
      immediate = balance;
      immediateBinding = "entire balance (no daily cap or envelope)";
      const envelope = policy.envelopeBps === 0 ? 0n : (balance * BigInt(policy.envelopeBps)) / 10_000n;
      if (caps.dailyMax !== 0n && caps.dailyMax < immediate) {
        immediate = caps.dailyMax;
        immediateBinding = "daily cap";
      }
      if (envelope !== 0n && envelope < immediate) {
        immediate = envelope;
        immediateBinding = "loss envelope";
      }
    } else {
      immediate = 0n;
      immediateBinding = "routine tier disabled by limits";
    }
  }

  // --- 24h: approvers can also push HIGH-tier transfers if delayHigh < 24h. Still bounded by caps.
  let day = 0n;
  let dayBinding = "no path";
  const highReachable = policy.delayHigh < 86_400;
  const envelope = policy.envelopeBps === 0 ? 0n : (balance * BigInt(policy.envelopeBps)) / 10_000n;
  const perTx = caps.perTxMax === 0n ? balance : caps.perTxMax;
  const highCeiling = policy.criticalExposureBps === 0 ? balance : (balance * BigInt(policy.criticalExposureBps - 1)) / 10_000n;
  const candidates: Array<[bigint, string]> = [];
  candidates.push([balance, "entire balance"]);
  if (caps.dailyMax !== 0n) candidates.push([caps.dailyMax * 2n, "two daily buckets across a boundary"]);
  if (envelope !== 0n) candidates.push([envelope * 2n, "two envelope windows across a boundary"]);
  if (!highReachable) {
    // Only LOW transfers fit in 24h; each is at most lowMax and the tier is bounded by exposure.
    candidates.push([immediate * 2n, "routine tier only, two buckets"]);
  } else {
    candidates.push([min(perTx, highCeiling) === 0n ? 0n : balance, "high tier reachable within 24h"]);
  }
  [day, dayBinding] = candidates.reduce((a, b) => (b[0] < a[0] ? b : a));
  if (mode === Mode.LOCKDOWN) {
    immediate = 0n;
    day = 0n;
    immediateBinding = "vault is in Lockdown";
    dayBinding = "vault is in Lockdown";
  }
  return {
    immediate,
    day,
    criticalDelay: policy.delayCritical,
    highDelay: policy.delayHigh,
    immediateBinding,
    dayBinding,
    assumptions,
  };
}

function min(...xs: bigint[]): bigint {
  return xs.reduce((a, b) => (b < a ? b : a));
}

export { Tier };
