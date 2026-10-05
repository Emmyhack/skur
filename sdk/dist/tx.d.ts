import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import type { AssetLimits, Mode, Policy, Trust } from './types.js';
/**
 * Programmable transaction blocks for every vault action.
 *
 * Two things here are worth knowing. First, a policy is built on chain by calling
 * `policy::new(...)` inside the same block, so the seventeen fields are validated by the module
 * that owns them rather than packed into bytes by this file. Second, creating a vault is one
 * block: `begin` hands back a value with no abilities, so the same transaction has to configure
 * the assets and call `finish`, and there is no moment when a half-configured vault exists.
 */
export type Builder = {
    tx: Transaction;
    packageId: string;
};
/** Build the `Policy` struct inside the block. */
export declare function policyArg(b: Builder, p: Policy): TransactionObjectArgument;
export type MemberSeed = {
    address: string;
    roles: number;
};
export type AssetSeed = {
    coinType: string;
    limits: AssetLimits;
};
export type RecipientSeed = {
    address: string;
    label: string;
};
/** `begin` → `setup_asset`* → `setup_recipient`* → `finish`, in one block. */
export declare function createVault(packageId: string, input: {
    name: string;
    policy: Policy;
    members: MemberSeed[];
    assets: AssetSeed[];
    recipients?: RecipientSeed[];
}): Transaction;
/**
 * Fund a vault. SUI comes out of the gas coin, which is the only coin a PTB always has; any other
 * asset is merged from the coin objects the caller holds and then split to the exact amount, so a
 * deposit never has to match a coin's balance.
 */
export declare function deposit(packageId: string, input: {
    vaultId: string;
    coinType: string;
    amount: bigint;
    coinObjectIds?: string[];
}): Transaction;
export declare function proposeTransfer(packageId: string, input: {
    vaultId: string;
    coinType: string;
    amount: bigint;
    recipient: string;
    memo?: string;
}): Transaction;
export declare const approve: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const reject: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const confirm: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const veto: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const cancel: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const expire: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const executePolicy: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const executeMember: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const executeRecipientTrust: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const executeModeRelax: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare const executeRecovery: (pkg: string, vaultId: string, id: bigint) => Transaction;
export declare function executeTransfer(packageId: string, input: {
    vaultId: string;
    coinType: string;
    proposalId: bigint;
}): Transaction;
export declare function registerRecipient(packageId: string, input: {
    vaultId: string;
    recipient: string;
    label: string;
}): Transaction;
/** A guardian restricting or blocking a destination, immediately and alone. */
export declare function guardianRestrict(packageId: string, input: {
    vaultId: string;
    recipient: string;
    trust: Trust;
}): Transaction;
export declare function raiseMode(packageId: string, input: {
    vaultId: string;
    mode: Mode;
    reasons?: number;
}): Transaction;
export declare function proposePolicy(packageId: string, input: {
    vaultId: string;
    policy: Policy;
}): Transaction;
export declare function proposeAssetLimits(packageId: string, input: {
    vaultId: string;
    coinType: string;
    limits: AssetLimits;
}): Transaction;
export declare function executeAssetLimits(packageId: string, input: {
    vaultId: string;
    coinType: string;
    proposalId: bigint;
}): Transaction;
/** `roles` of 0 removes the member. */
export declare function proposeMember(packageId: string, input: {
    vaultId: string;
    member: string;
    roles: number;
}): Transaction;
export declare function proposeRecipientTrust(packageId: string, input: {
    vaultId: string;
    recipient: string;
    trust: Trust;
}): Transaction;
export declare function proposeModeRelax(packageId: string, input: {
    vaultId: string;
    mode: Mode;
}): Transaction;
export declare function proposeRecovery(packageId: string, input: {
    vaultId: string;
    lost: string;
    replacement: string;
}): Transaction;
/** The block used to read `preview_transfer` back through a simulation. */
export declare function previewTransferTx(packageId: string, input: {
    vaultId: string;
    coinType: string;
    amount: bigint;
    recipient: string;
}): Transaction;
//# sourceMappingURL=tx.d.ts.map