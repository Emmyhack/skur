/**
 * Formatting for amounts, durations and shares. No chain dependency: the EVM build imported these
 * from viem, which is why they are implemented here instead.
 *
 * Durations are milliseconds throughout, matching `sui::clock`.
 */
export declare function formatUnits(value: bigint, decimals: number): string;
export declare function parseUnits(text: string, decimals: number): bigint | null;
export declare function short(addr: string, n?: number): string;
export declare function fmtAmount(value: bigint, decimals: number, symbol?: string, maxFrac?: number): string;
export declare function parseAmount(text: string, decimals: number): bigint | null;
export declare function fmtBps(bps: number): string;
/** Milliseconds to something a person reads. */
export declare function fmtDuration(ms: number): string;
export declare function fmtTimestamp(ms: number | bigint): string;
export declare function fmtRelative(ms: number | bigint, now?: number): string;
//# sourceMappingURL=format.d.ts.map