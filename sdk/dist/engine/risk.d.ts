import { Mode, Tier, Trust, type Policy } from '../types.js';
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
export type RiskOutput = {
    tier: Tier;
    reasons: number;
    exposureBps: number;
};
export declare function exposureBps(amount: bigint, balance: bigint): number;
export declare function classify(i: RiskInput): RiskOutput;
export declare function requirements(p: Policy, tier: Tier): {
    approvals: number;
    guardians: number;
    delay: number;
};
/** Elevated halves the caps, floored at one unit. No cap stays no cap. */
export declare function effectiveCaps(perTxMax: bigint, dailyMax: bigint, mode: Mode): {
    perTxMax: bigint;
    dailyMax: bigint;
};
//# sourceMappingURL=risk.d.ts.map