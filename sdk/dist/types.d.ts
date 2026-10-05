/**
 * The vocabulary, kept identical to `sui/sources/types.move`. Anything that disagrees with the
 * chain is a bug in this file, not in the contract.
 *
 * Durations are milliseconds everywhere, because that is what `sui::clock` reports. Amounts are
 * `bigint` in the smallest unit of their coin type.
 */
export declare const Role: {
    readonly OWNER: 1;
    readonly APPROVER: 2;
    readonly EXECUTOR: 4;
    readonly GUARDIAN: 8;
    /** An automated agent: may open proposals and nothing else. */
    readonly PROPOSER: 16;
};
export type Role = (typeof Role)[keyof typeof Role];
export declare const ROLE_TREASURY_MASK: number;
export declare const ROLE_ALL = 31;
export declare const ROLE_LABELS: Record<number, string>;
export declare function hasRole(bits: number, role: Role | number): boolean;
export declare function hasAnyRole(bits: number, mask: number): boolean;
export declare function canPropose(bits: number): boolean;
/** A guardian is the second control plane and may hold no treasury role. */
export declare function rolesValid(bits: number): boolean;
export declare function describeRoles(bits: number): string[];
export declare const Tier: {
    readonly LOW: 0;
    readonly HIGH: 1;
    readonly CRITICAL: 2;
};
export type Tier = (typeof Tier)[keyof typeof Tier];
export declare const TIER_LABELS: Record<Tier, string>;
export declare const Trust: {
    readonly UNKNOWN: 0;
    readonly NEW: 1;
    readonly VERIFIED: 2;
    readonly TRUSTED: 3;
    readonly RESTRICTED: 4;
    readonly BLOCKED: 5;
};
export type Trust = (typeof Trust)[keyof typeof Trust];
export declare const TRUST_LABELS: Record<Trust, string>;
export declare const Mode: {
    readonly NORMAL: 0;
    readonly ELEVATED: 1;
    readonly LOCKDOWN: 2;
};
export type Mode = (typeof Mode)[keyof typeof Mode];
export declare const MODE_LABELS: Record<Mode, string>;
export declare const Kind: {
    readonly TRANSFER: 0;
    readonly POLICY_UPDATE: 1;
    readonly ASSET_LIMITS: 2;
    readonly MEMBER_SET: 3;
    readonly RECIPIENT_TRUST: 4;
    readonly MODE_RELAX: 5;
    readonly RECOVERY: 6;
};
export type Kind = (typeof Kind)[keyof typeof Kind];
export declare const KIND_LABELS: Record<Kind, string>;
export declare const Status: {
    readonly NONE: 0;
    readonly PENDING: 1;
    readonly EXECUTED: 2;
    readonly CANCELLED: 3;
    readonly VETOED: 4;
    readonly EXPIRED: 5;
    /** Refused by the circuit breaker. The vault latched into Lockdown instead of paying. */
    readonly BLOCKED: 6;
    /** Turned down by the signers: as many rejections as it needed approvals. */
    readonly REJECTED: 7;
};
export type Status = (typeof Status)[keyof typeof Status];
export declare const STATUS_LABELS: Record<Status, string>;
export declare const Reason: {
    readonly AMOUNT_HIGH: 1;
    readonly AMOUNT_CRITICAL: 2;
    readonly EXPOSURE_HIGH: 4;
    readonly EXPOSURE_CRITICAL: 8;
    readonly RECIPIENT_PROBATION: 16;
    readonly RECIPIENT_RESTRICTED: 32;
    readonly MODE_ELEVATED: 64;
    readonly VELOCITY_PRESSURE: 128;
    readonly RECIPIENT_UNKNOWN: 256;
    readonly ENVELOPE_PRESSURE: 512;
};
export type Reason = (typeof Reason)[keyof typeof Reason];
/** Plain-language explanations, in the order a reviewer should read them. */
export declare const REASON_TEXT: [Reason, string][];
export declare function describeReasons(mask: number): string[];
export declare const BPS = 10000n;
export declare const SECOND = 1000;
export declare const MINUTE: number;
export declare const HOUR: number;
export declare const DAY: number;
/** The seventeen fields. Durations in milliseconds, exposures in basis points. */
export type Policy = {
    approvalsLow: number;
    approvalsHigh: number;
    approvalsCritical: number;
    governanceThreshold: number;
    guardianThreshold: number;
    guardianRequiredCritical: boolean;
    delayHigh: number;
    delayCritical: number;
    recipientActivationDelay: number;
    policyChangeDelay: number;
    recoveryDelay: number;
    proposalTtl: number;
    highExposureBps: number;
    criticalExposureBps: number;
    hardBlockExposureBps: number;
    envelopeBps: number;
    envelopeWindow: number;
};
export type AssetLimits = {
    approved: boolean;
    lowMax: bigint;
    highMax: bigint;
    perTxMax: bigint;
    dailyMax: bigint;
};
export type Velocity = {
    dayAnchor: number;
    daySpent: bigint;
    envelopeAnchor: number;
    envelopeSpent: bigint;
    /** The balance when the window opened; the envelope is measured against this, not the live
     * balance, so a drain cannot shrink its own denominator. */
    envelopeBasis: bigint;
};
export type RecipientRecord = {
    address: string;
    trust: Trust;
    registeredAt: number;
    activatesAt: number;
    paidCount: number;
    lastPaid: number;
    label: string;
};
export type Proposal = {
    id: bigint;
    kind: Kind;
    status: Status;
    proposer: string;
    createdAt: number;
    executableAt: number;
    expiresAt: number;
    reqApprovals: number;
    reqGuardians: number;
    tier: Tier;
    reasons: number;
    exposureBps: number;
    policyVersion: bigint;
    reductionMask: number;
    approvals: string[];
    confirmations: string[];
    rejections: string[];
    asset: string | null;
    amount: bigint;
    recipient: string;
    memo: string;
    newPolicy: Policy | null;
    newLimits: AssetLimits | null;
    member: string;
    memberPrev: string;
    memberRoles: number;
    trustLevel: Trust;
    targetMode: Mode;
};
export type VaultSummary = {
    id: string;
    name: string;
    policy: Policy;
    policyVersion: bigint;
    mode: Mode;
    postureReasons: number;
    ownerCount: number;
    approverCount: number;
    executorCount: number;
    guardianCount: number;
    nextProposal: bigint;
    pendingCount: number;
    createdAt: number;
    /** Table and Bag object ids, needed to read the collections by dynamic field. */
    tables: {
        members: string;
        limits: string;
        funds: string;
        velocity: string;
        recipients: string;
        proposals: string;
    };
    sizes: {
        members: number;
        limits: number;
        funds: number;
        velocity: number;
        recipients: number;
        proposals: number;
    };
};
/** What `preview_transfer` returns, in order. */
export type TransferPreview = {
    tier: Tier;
    reasons: number;
    exposureBps: number;
    reqApprovals: number;
    reqGuardians: number;
    delay: number;
};
//# sourceMappingURL=types.d.ts.map