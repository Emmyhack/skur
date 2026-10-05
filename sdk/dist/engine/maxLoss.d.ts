import { Mode, type AssetLimits, type Policy } from '../types.js';
/**
 * Maximum possible loss per asset, turned from a policy into numbers a finance team can act on.
 *
 * Conservative by construction: it assumes every signer a tier needs is compromised and
 * cooperating, and that the attacker picks amounts optimally. It is an upper bound under the
 * stated assumptions and never a guarantee — the assumptions are returned alongside the numbers
 * so they cannot be quoted without them.
 */
export type MaxLoss = {
    /** The most that can leave with no delay at all. */
    immediate: bigint;
    /** The most that can leave within a day if no guardian acts. */
    day: bigint;
    criticalDelay: number;
    highDelay: number;
    /** Which control produced each number. */
    immediateBinding: string;
    dayBinding: string;
    assumptions: string[];
};
export declare function computeMaxLoss(policy: Policy, limits: AssetLimits, balance: bigint, mode: Mode): MaxLoss;
//# sourceMappingURL=maxLoss.d.ts.map