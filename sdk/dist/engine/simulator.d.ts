import { type AssetLimits, type Policy } from '../types.js';
/**
 * Runs a policy against the attacks that actually happen, before the policy is live. Every verdict
 * is the deterministic risk engine plus the vault's own limit checks — nothing here is heuristic,
 * and nothing here is a score.
 */
export type Verdict = 'blocked' | 'delayed' | 'escalated' | 'allowed' | 'impossible';
export type ScenarioResult = {
    id: string;
    title: string;
    narrative: string;
    verdict: Verdict;
    detail: string[];
};
export type SimContext = {
    policy: Policy;
    limits: AssetLimits;
    balance: bigint;
    decimals: number;
    symbol: string;
    approverCount: number;
    guardianCount: number;
};
export declare function runScenarios(ctx: SimContext): ScenarioResult[];
//# sourceMappingURL=simulator.d.ts.map