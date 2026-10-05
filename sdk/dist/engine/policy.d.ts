import { Trust, type AssetLimits, type Policy } from '../types.js';
export declare const OK = 0;
export declare function validatePolicyCode(p: Policy): number;
export declare function longestDelay(p: Policy): number;
/** Every failing rule, not just the first, so an editor can mark all of them at once. */
export declare function validatePolicy(p: Policy): string[];
export declare function validateLimits(l: AssetLimits): string[];
export declare function validateCounts(p: Policy, owners: number, approvers: number, executors: number, guardians: number): string[];
/** The fields `b` gives up relative to `a`. Empty means the change only tightens. */
export declare function policyReductions(a: Policy, b: Policy): string[];
export declare function limitReductions(a: AssetLimits, b: AssetLimits): string[];
/** Raising trust, or lifting a restriction, is security-reducing; tightening is not. */
export declare function trustReduces(from: Trust, to: Trust): boolean;
//# sourceMappingURL=policy.d.ts.map