import { type Policy } from '../types.js';
/** Field metadata for the policy editor, shared by every interface. */
export type Unit = 'count' | 'hours' | 'bps' | 'bool';
export type PolicyField = {
    key: keyof Policy;
    label: string;
    hint: string;
    unit: Unit;
    max?: number;
};
/** Editors show hours; the policy stores milliseconds. */
export declare const HOUR_MS: number;
export declare const toHours: (ms: number) => number;
export declare const fromHours: (h: number) => number;
export declare const POLICY_GROUPS: {
    title: string;
    sub: string;
    fields: PolicyField[];
}[];
//# sourceMappingURL=policyFields.d.ts.map