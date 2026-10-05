import type { ClientWithCoreApi } from '@mysten/sui/client';
import { AssetLimitsBcs, PolicyBcs } from './bcs.js';
import type { Kind, Mode, Status, Tier, Trust } from './types.js';
export declare const EVENT_NAMES: readonly ["VaultCreated", "Deposited", "ProposalOpened", "Approved", "Confirmed", "Settled", "Executed", "BreakerTripped", "ModeChanged", "PolicyChanged", "LimitsChanged", "MemberChanged", "RecipientRegistered", "RecipientTrustChanged", "Recovered"];
export type EventName = (typeof EVENT_NAMES)[number];
export type SkurEvent = {
    name: 'VaultCreated';
    vault: string;
    vaultName: string;
    creator: string;
    ownerCount: number;
    guardianCount: number;
    at: number;
} | {
    name: 'Deposited';
    vault: string;
    asset: string;
    amount: bigint;
    balance: bigint;
    from: string;
    at: number;
} | {
    name: 'ProposalOpened';
    vault: string;
    proposal: bigint;
    kind: Kind;
    proposer: string;
    asset: string | null;
    amount: bigint;
    recipient: string;
    tier: Tier;
    reasons: number;
    exposureBps: number;
    reqApprovals: number;
    reqGuardians: number;
    executableAt: number;
    expiresAt: number;
    reductionMask: number;
    memo: string;
    at: number;
} | {
    name: 'Approved';
    vault: string;
    proposal: bigint;
    approver: string;
    approvals: number;
    reqApprovals: number;
    at: number;
} | {
    name: 'Confirmed';
    vault: string;
    proposal: bigint;
    guardian: string;
    confirmations: number;
    reqGuardians: number;
    at: number;
} | {
    name: 'Settled';
    vault: string;
    proposal: bigint;
    kind: Kind;
    status: Status;
    actor: string;
    at: number;
} | {
    name: 'Executed';
    vault: string;
    proposal: bigint;
    kind: Kind;
    asset: string | null;
    amount: bigint;
    recipient: string;
    executor: string;
    tier: Tier;
    balanceAfter: bigint;
    daySpent: bigint;
    at: number;
} | {
    name: 'BreakerTripped';
    vault: string;
    proposal: bigint;
    asset: string;
    amount: bigint;
    envelopeSpent: bigint;
    envelopeLimit: bigint;
    envelopeBasis: bigint;
    at: number;
} | {
    name: 'ModeChanged';
    vault: string;
    from: Mode;
    to: Mode;
    actor: string;
    reasons: number;
    at: number;
} | {
    name: 'PolicyChanged';
    vault: string;
    proposal: bigint;
    version: bigint;
    reductionMask: number;
    at: number;
} | {
    name: 'LimitsChanged';
    vault: string;
    proposal: bigint;
    asset: string;
    approved: boolean;
    lowMax: bigint;
    highMax: bigint;
    perTxMax: bigint;
    dailyMax: bigint;
    reductionMask: number;
    at: number;
} | {
    name: 'MemberChanged';
    vault: string;
    proposal: bigint;
    member: string;
    rolesBefore: number;
    rolesAfter: number;
    at: number;
} | {
    name: 'RecipientRegistered';
    vault: string;
    recipient: string;
    trust: Trust;
    activatesAt: number;
    label: string;
    actor: string;
    at: number;
} | {
    name: 'RecipientTrustChanged';
    vault: string;
    proposal: bigint;
    recipient: string;
    from: Trust;
    to: Trust;
    actor: string;
    at: number;
} | {
    name: 'Recovered';
    vault: string;
    proposal: bigint;
    lost: string;
    replacement: string;
    roles: number;
    at: number;
};
/** Ledger position, so an indexer can resume exactly where it stopped. */
export type EventPosition = {
    transactionDigest: string;
    eventIndex: number;
    checkpoint?: string;
    timestampMs?: number;
};
export type DecodedEvent = {
    event: SkurEvent;
    position: EventPosition;
};
/** Decode one Move event into a tagged union, or null if it is not one of ours. */
export declare function decodeEvent(eventType: string, bytes: Uint8Array): SkurEvent | null;
/**
 * Page through the package's events. The filter is `emitModule`, which is one predicate and so
 * works on every transport; events for other vaults are dropped client-side when `vaultId` is
 * given, because a module-wide filter is the finest the portable API offers.
 */
export declare function listVaultEvents(client: ClientWithCoreApi, input: {
    packageId: string;
    vaultId?: string;
    limit?: number;
    /** Walk forwards from here. Use for indexing and for polling what is new. */
    after?: string | null;
    /** Walk backwards from here. Use for an interface showing newest first. */
    before?: string | null;
    order?: 'ascending' | 'descending';
}): Promise<{
    events: DecodedEvent[];
    startCursor: string | null;
    endCursor: string | null;
    hasNextPage: boolean;
}>;
/** The Move type of one of our events, for a precise `eventType` filter. */
export declare function eventType(packageId: string, name: EventName): string;
export { PolicyBcs, AssetLimitsBcs };
//# sourceMappingURL=events.d.ts.map