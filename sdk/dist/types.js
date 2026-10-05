/**
 * The vocabulary, kept identical to `sui/sources/types.move`. Anything that disagrees with the
 * chain is a bug in this file, not in the contract.
 *
 * Durations are milliseconds everywhere, because that is what `sui::clock` reports. Amounts are
 * `bigint` in the smallest unit of their coin type.
 */
export const Role = {
    OWNER: 1,
    APPROVER: 2,
    EXECUTOR: 4,
    GUARDIAN: 8,
    /** An automated agent: may open proposals and nothing else. */
    PROPOSER: 16,
};
export const ROLE_TREASURY_MASK = Role.OWNER | Role.APPROVER | Role.EXECUTOR | Role.PROPOSER;
export const ROLE_ALL = 31;
export const ROLE_LABELS = {
    [Role.OWNER]: 'Owner',
    [Role.APPROVER]: 'Approver',
    [Role.EXECUTOR]: 'Executor',
    [Role.GUARDIAN]: 'Guardian',
    [Role.PROPOSER]: 'Proposer',
};
export function hasRole(bits, role) {
    return (bits & role) === role;
}
export function hasAnyRole(bits, mask) {
    return (bits & mask) !== 0;
}
export function canPropose(bits) {
    return hasAnyRole(bits, ROLE_TREASURY_MASK);
}
/** A guardian is the second control plane and may hold no treasury role. */
export function rolesValid(bits) {
    if (bits === 0 || bits > ROLE_ALL)
        return false;
    if (hasRole(bits, Role.GUARDIAN) && (bits & ROLE_TREASURY_MASK) !== 0)
        return false;
    return true;
}
export function describeRoles(bits) {
    return Object.values(Role)
        .filter((r) => hasRole(bits, r))
        .map((r) => ROLE_LABELS[r]);
}
export const Tier = { LOW: 0, HIGH: 1, CRITICAL: 2 };
export const TIER_LABELS = {
    [Tier.LOW]: 'Routine',
    [Tier.HIGH]: 'High risk',
    [Tier.CRITICAL]: 'Critical',
};
export const Trust = {
    UNKNOWN: 0,
    NEW: 1,
    VERIFIED: 2,
    TRUSTED: 3,
    RESTRICTED: 4,
    BLOCKED: 5,
};
export const TRUST_LABELS = {
    [Trust.UNKNOWN]: 'Never paid',
    [Trust.NEW]: 'New',
    [Trust.VERIFIED]: 'Verified',
    [Trust.TRUSTED]: 'Trusted',
    [Trust.RESTRICTED]: 'Restricted',
    [Trust.BLOCKED]: 'Blocked',
};
export const Mode = { NORMAL: 0, ELEVATED: 1, LOCKDOWN: 2 };
export const MODE_LABELS = {
    [Mode.NORMAL]: 'Normal',
    [Mode.ELEVATED]: 'Elevated',
    [Mode.LOCKDOWN]: 'Lockdown',
};
export const Kind = {
    TRANSFER: 0,
    POLICY_UPDATE: 1,
    ASSET_LIMITS: 2,
    MEMBER_SET: 3,
    RECIPIENT_TRUST: 4,
    MODE_RELAX: 5,
    RECOVERY: 6,
};
export const KIND_LABELS = {
    [Kind.TRANSFER]: 'Payment',
    [Kind.POLICY_UPDATE]: 'Policy change',
    [Kind.ASSET_LIMITS]: 'Asset limits',
    [Kind.MEMBER_SET]: 'Signer change',
    [Kind.RECIPIENT_TRUST]: 'Recipient trust',
    [Kind.MODE_RELAX]: 'Lower security mode',
    [Kind.RECOVERY]: 'Signer recovery',
};
export const Status = {
    NONE: 0,
    PENDING: 1,
    EXECUTED: 2,
    CANCELLED: 3,
    VETOED: 4,
    EXPIRED: 5,
    /** Refused by the circuit breaker. The vault latched into Lockdown instead of paying. */
    BLOCKED: 6,
};
export const STATUS_LABELS = {
    [Status.NONE]: 'Unknown',
    [Status.PENDING]: 'Awaiting approval',
    [Status.EXECUTED]: 'Executed',
    [Status.CANCELLED]: 'Cancelled',
    [Status.VETOED]: 'Vetoed',
    [Status.EXPIRED]: 'Expired',
    [Status.BLOCKED]: 'Refused by the circuit breaker',
};
export const Reason = {
    AMOUNT_HIGH: 1,
    AMOUNT_CRITICAL: 2,
    EXPOSURE_HIGH: 4,
    EXPOSURE_CRITICAL: 8,
    RECIPIENT_PROBATION: 16,
    RECIPIENT_RESTRICTED: 32,
    MODE_ELEVATED: 64,
    VELOCITY_PRESSURE: 128,
    RECIPIENT_UNKNOWN: 256,
    ENVELOPE_PRESSURE: 512,
};
/** Plain-language explanations, in the order a reviewer should read them. */
export const REASON_TEXT = [
    [Reason.AMOUNT_CRITICAL, 'Above the high-tier maximum for this asset'],
    [Reason.AMOUNT_HIGH, 'Above the routine maximum for this asset'],
    [Reason.EXPOSURE_CRITICAL, 'A critical share of what the vault holds'],
    [Reason.EXPOSURE_HIGH, 'A large share of what the vault holds'],
    [Reason.RECIPIENT_RESTRICTED, 'The recipient is restricted'],
    [Reason.RECIPIENT_UNKNOWN, 'The vault has never paid this address'],
    [Reason.RECIPIENT_PROBATION, 'The recipient is still in its activation delay'],
    [Reason.VELOCITY_PRESSURE, "Past half of today's allowance for this asset"],
    [Reason.ENVELOPE_PRESSURE, 'Against the loss envelope for the window'],
    [Reason.MODE_ELEVATED, 'The vault is in Elevated mode'],
];
export function describeReasons(mask) {
    return REASON_TEXT.filter(([bit]) => (mask & bit) !== 0).map(([, text]) => text);
}
export const BPS = 10000n;
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
//# sourceMappingURL=types.js.map