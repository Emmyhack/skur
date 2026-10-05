import { type AssetLimits, type Policy } from '../types.js';
/**
 * Plain-language posture checks. This reports confirmed controls and obvious weaknesses; it does
 * not claim to measure absolute security, and it deliberately produces no score.
 */
export type PostureItem = {
    ok: 'ok' | 'warn' | 'bad';
    text: string;
};
export type PostureInput = {
    policy: Policy;
    guardians: number;
    assets: {
        symbol: string;
        limits: AssetLimits;
    }[];
};
export declare function postureItems({ policy: p, guardians: g, assets }: PostureInput): PostureItem[];
//# sourceMappingURL=posture.d.ts.map