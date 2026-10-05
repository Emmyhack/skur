/**
 * Move abort codes, mapped to the sentence a person should read. The numbers are the constants in
 * `sui/sources/policy.move` and `sui/sources/vault.move`; a change there is a change here.
 *
 * A Sui abort arrives as a `MoveAbort` in the execution status, carrying the module and the code,
 * so an interface can be specific about why a transaction was refused rather than saying "failed".
 */
export declare const POLICY_ERRORS: Record<number, string>;
export declare const VAULT_ERRORS: Record<number, string>;
export declare function describeAbort(module: string | undefined, code: number | bigint): string;
/** Pull a readable reason out of a failed execution result. */
export declare function describeFailure(error: unknown): string;
//# sourceMappingURL=errors.d.ts.map