import { type AssetLimits, type Policy } from '../types.js';
/**
 * Starting policies, one per kind of organization. Nobody designs seventeen fields from first
 * principles; they pick the closest fit and tighten from there, which is why every template is a
 * complete and valid policy rather than a partial preset.
 *
 * Amounts assume a 6-decimal stablecoin (USDC on Sui) and 9-decimal SUI.
 */
export declare const USDC = 1000000n;
export declare const SUI = 1000000000n;
export type TemplateId = 'startup' | 'team' | 'protocol' | 'fund' | 'payments' | 'nonprofit' | 'familyOffice';
export type Template = {
    id: TemplateId;
    name: string;
    tagline: string;
    /** Who this is for, in the words that organization would use. */
    audience: string;
    minSigners: number;
    minGuardians: number;
    policy: Policy;
    stable: AssetLimits;
    native: AssetLimits;
};
export declare const TEMPLATES: Template[];
export declare function templateById(id: TemplateId): Template;
//# sourceMappingURL=templates.d.ts.map