/// Shared vocabulary for the Skur authorization layer: roles, risk tiers, recipient trust,
/// security modes, proposal kinds and the reasons a payment was escalated.
///
/// These are the same values the TypeScript engine and the interfaces use, so a tier shown to a
/// signer is the tier the chain computed.
module skur::types;

// ---------------------------------------------------------------- roles (a bitmask per member)
const ROLE_OWNER: u8 = 1;
const ROLE_APPROVER: u8 = 2;
const ROLE_EXECUTOR: u8 = 4;
const ROLE_GUARDIAN: u8 = 8;
/// A proposer may open proposals and nothing else. It is the role an automated agent holds: it
/// can ask the treasury to pay, it cannot approve, confirm or execute, and so it can never move
/// money on its own however thoroughly it is compromised.
const ROLE_PROPOSER: u8 = 16;
const ROLE_TREASURY_MASK: u8 = 23; // owner | approver | executor | proposer
/// Any role that is allowed to open a proposal.
const ROLE_CAN_PROPOSE: u8 = 23;
const ROLE_ALL: u8 = 31;

public fun role_owner(): u8 { ROLE_OWNER }
public fun role_approver(): u8 { ROLE_APPROVER }
public fun role_executor(): u8 { ROLE_EXECUTOR }
public fun role_guardian(): u8 { ROLE_GUARDIAN }
public fun role_proposer(): u8 { ROLE_PROPOSER }
public fun role_treasury_mask(): u8 { ROLE_TREASURY_MASK }

public fun has_role(bits: u8, role: u8): bool { bits & role == role }

/// True when the member holds at least one of the roles in `mask`.
public fun has_any(bits: u8, mask: u8): bool { bits & mask != 0 }

public fun can_propose(bits: u8): bool { has_any(bits, ROLE_CAN_PROPOSE) }

/// A guardian is the second control plane: it may hold no treasury role, and no treasury member
/// may hold it. That is what stops one stolen credential from both proposing and vetoing.
public fun roles_valid(bits: u8): bool {
    if (bits == 0) return false;
    if (bits > ROLE_ALL) return false;
    if (has_role(bits, ROLE_GUARDIAN) && (bits & ROLE_TREASURY_MASK) != 0) return false;
    true
}

// ---------------------------------------------------------------- risk tiers
const TIER_LOW: u8 = 0;
const TIER_HIGH: u8 = 1;
const TIER_CRITICAL: u8 = 2;

public fun tier_low(): u8 { TIER_LOW }
public fun tier_high(): u8 { TIER_HIGH }
public fun tier_critical(): u8 { TIER_CRITICAL }

// ---------------------------------------------------------------- recipient trust
const TRUST_UNKNOWN: u8 = 0;
const TRUST_NEW: u8 = 1;
const TRUST_VERIFIED: u8 = 2;
const TRUST_TRUSTED: u8 = 3;
const TRUST_RESTRICTED: u8 = 4;
const TRUST_BLOCKED: u8 = 5;

public fun trust_unknown(): u8 { TRUST_UNKNOWN }
public fun trust_new(): u8 { TRUST_NEW }
public fun trust_verified(): u8 { TRUST_VERIFIED }
public fun trust_trusted(): u8 { TRUST_TRUSTED }
public fun trust_restricted(): u8 { TRUST_RESTRICTED }
public fun trust_blocked(): u8 { TRUST_BLOCKED }
public fun trust_valid(t: u8): bool { t <= TRUST_BLOCKED }

// ---------------------------------------------------------------- security modes
const MODE_NORMAL: u8 = 0;
const MODE_ELEVATED: u8 = 1;
const MODE_LOCKDOWN: u8 = 2;

public fun mode_normal(): u8 { MODE_NORMAL }
public fun mode_elevated(): u8 { MODE_ELEVATED }
public fun mode_lockdown(): u8 { MODE_LOCKDOWN }

// ---------------------------------------------------------------- proposal kinds
const KIND_TRANSFER: u8 = 0;
const KIND_POLICY_UPDATE: u8 = 1;
const KIND_ASSET_LIMITS: u8 = 2;
const KIND_MEMBER_SET: u8 = 3;
const KIND_RECIPIENT_TRUST: u8 = 4;
const KIND_MODE_RELAX: u8 = 5;
const KIND_RECOVERY: u8 = 6;

public fun kind_transfer(): u8 { KIND_TRANSFER }
public fun kind_policy_update(): u8 { KIND_POLICY_UPDATE }
public fun kind_asset_limits(): u8 { KIND_ASSET_LIMITS }
public fun kind_member_set(): u8 { KIND_MEMBER_SET }
public fun kind_recipient_trust(): u8 { KIND_RECIPIENT_TRUST }
public fun kind_mode_relax(): u8 { KIND_MODE_RELAX }
public fun kind_recovery(): u8 { KIND_RECOVERY }

// ---------------------------------------------------------------- proposal status
const STATUS_PENDING: u8 = 1;
const STATUS_EXECUTED: u8 = 2;
const STATUS_CANCELLED: u8 = 3;
const STATUS_VETOED: u8 = 4;
const STATUS_EXPIRED: u8 = 5;
/// Refused at execution by a control that must survive the attempt: the circuit breaker. The
/// transaction still succeeds, because the latch it sets has to persist.
const STATUS_BLOCKED: u8 = 6;
/// Turned down by the signers. It takes as many rejections as the proposal needed approvals, so
/// rejecting is exactly as hard as approving and a single signer cannot block the queue.
const STATUS_REJECTED: u8 = 7;

public fun status_pending(): u8 { STATUS_PENDING }
public fun status_executed(): u8 { STATUS_EXECUTED }
public fun status_cancelled(): u8 { STATUS_CANCELLED }
public fun status_vetoed(): u8 { STATUS_VETOED }
public fun status_expired(): u8 { STATUS_EXPIRED }
public fun status_blocked(): u8 { STATUS_BLOCKED }
public fun status_rejected(): u8 { STATUS_REJECTED }

// ---------------------------------------------------------------- why a payment was escalated
const REASON_AMOUNT_HIGH: u16 = 1;
const REASON_AMOUNT_CRITICAL: u16 = 2;
const REASON_EXPOSURE_HIGH: u16 = 4;
const REASON_EXPOSURE_CRITICAL: u16 = 8;
const REASON_RECIPIENT_PROBATION: u16 = 16;
const REASON_RECIPIENT_RESTRICTED: u16 = 32;
const REASON_MODE_ELEVATED: u16 = 64;
const REASON_VELOCITY_PRESSURE: u16 = 128;
const REASON_RECIPIENT_UNKNOWN: u16 = 256;
const REASON_ENVELOPE_PRESSURE: u16 = 512;

public fun reason_amount_high(): u16 { REASON_AMOUNT_HIGH }
public fun reason_amount_critical(): u16 { REASON_AMOUNT_CRITICAL }
public fun reason_exposure_high(): u16 { REASON_EXPOSURE_HIGH }
public fun reason_exposure_critical(): u16 { REASON_EXPOSURE_CRITICAL }
public fun reason_recipient_probation(): u16 { REASON_RECIPIENT_PROBATION }
public fun reason_recipient_restricted(): u16 { REASON_RECIPIENT_RESTRICTED }
public fun reason_mode_elevated(): u16 { REASON_MODE_ELEVATED }
public fun reason_velocity_pressure(): u16 { REASON_VELOCITY_PRESSURE }
public fun reason_recipient_unknown(): u16 { REASON_RECIPIENT_UNKNOWN }
public fun reason_envelope_pressure(): u16 { REASON_ENVELOPE_PRESSURE }

/// Basis points denominator, and one hour in milliseconds (Sui clocks are millisecond-based).
const BPS: u64 = 10_000;
const HOUR_MS: u64 = 3_600_000;
const DAY_MS: u64 = 86_400_000;

public fun bps(): u64 { BPS }
public fun hour_ms(): u64 { HOUR_MS }
public fun day_ms(): u64 { DAY_MS }
