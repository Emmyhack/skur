/// The policy: seventeen fields that decide how much authorization a payment needs, how long it
/// waits, and how much can leave in a window. Plus the two things a policy module must be able to
/// answer: is this policy internally coherent, and does this change weaken the vault?
///
/// Durations are milliseconds, because that is the unit `sui::clock` reports. The TypeScript
/// engine keeps the same fields in seconds and converts once, at the SDK boundary.
module skur::policy;

use skur::types;

// ---------------------------------------------------------------- validation failure codes
// Returned (not aborted) by `validate`, so an interface can dry-run a draft policy and show the
// precise reason. `assert_valid` turns a non-zero code into an abort with the same number.
const E_OK: u64 = 0;
const E_APPROVALS_LOW_ZERO: u64 = 1;
const E_APPROVALS_HIGH_BELOW_LOW: u64 = 2;
const E_APPROVALS_CRITICAL_BELOW_HIGH: u64 = 3;
const E_GOVERNANCE_ZERO: u64 = 4;
const E_GUARDIAN_REQUIRED_WITHOUT_THRESHOLD: u64 = 5;
const E_CRITICAL_DELAY_BELOW_HIGH: u64 = 6;
const E_HIGH_EXPOSURE_ABOVE_CRITICAL: u64 = 7;
const E_EXPOSURE_ABOVE_FULL: u64 = 8;
const E_HARD_BLOCK_BELOW_CRITICAL: u64 = 9;
const E_HARD_BLOCK_ABOVE_FULL: u64 = 10;
const E_ENVELOPE_ABOVE_FULL: u64 = 11;
const E_ENVELOPE_WINDOW_TOO_SHORT: u64 = 12;
const E_TTL_BELOW_LONGEST_DELAY: u64 = 13;

const E_LIMITS_LOW_ABOVE_HIGH: u64 = 20;
const E_LIMITS_PER_TX_ABOVE_DAILY: u64 = 21;

const E_NO_OWNER: u64 = 30;
const E_NO_EXECUTOR: u64 = 31;
const E_GOVERNANCE_EXCEEDS_OWNERS: u64 = 32;
const E_CRITICAL_EXCEEDS_APPROVERS: u64 = 33;
const E_GUARDIAN_THRESHOLD_EXCEEDS_GUARDIANS: u64 = 34;

public fun e_ok(): u64 { E_OK }

/// A proposal must stay executable for at least an hour after its delay elapses, otherwise a
/// policy could be written whose transfers expire before anyone can execute them.
const MIN_EXECUTION_WINDOW_MS: u64 = 3_600_000;

public fun min_execution_window_ms(): u64 { MIN_EXECUTION_WINDOW_MS }

// ---------------------------------------------------------------- the policy
public struct Policy has copy, drop, store {
    /// Approvals required at each risk tier. Monotonic: low <= high <= critical.
    approvals_low: u8,
    approvals_high: u8,
    approvals_critical: u8,
    /// Owner approvals required for any governance action (policy, members, limits, trust).
    governance_threshold: u8,
    /// Guardian confirmations required when a guardian is in the loop.
    guardian_threshold: u8,
    /// Whether a critical transfer needs guardian confirmation on top of approver approvals.
    guardian_required_critical: bool,
    /// Timelocks, in milliseconds.
    delay_high: u64,
    delay_critical: u64,
    recipient_activation_delay: u64,
    policy_change_delay: u64,
    recovery_delay: u64,
    /// How long a proposal remains executable before it expires.
    proposal_ttl: u64,
    /// Share of the asset's balance, in basis points, that escalates a transfer.
    /// Zero disables the threshold.
    high_exposure_bps: u64,
    critical_exposure_bps: u64,
    /// Share of balance that is refused outright, whatever the approvals. Zero disables it.
    hard_block_exposure_bps: u64,
    /// The circuit breaker: how much of the balance may leave per window before the vault latches
    /// into Lockdown. Zero disables the breaker.
    envelope_bps: u64,
    envelope_window: u64,
}

public fun new(
    approvals_low: u8,
    approvals_high: u8,
    approvals_critical: u8,
    governance_threshold: u8,
    guardian_threshold: u8,
    guardian_required_critical: bool,
    delay_high: u64,
    delay_critical: u64,
    recipient_activation_delay: u64,
    policy_change_delay: u64,
    recovery_delay: u64,
    proposal_ttl: u64,
    high_exposure_bps: u64,
    critical_exposure_bps: u64,
    hard_block_exposure_bps: u64,
    envelope_bps: u64,
    envelope_window: u64,
): Policy {
    Policy {
        approvals_low,
        approvals_high,
        approvals_critical,
        governance_threshold,
        guardian_threshold,
        guardian_required_critical,
        delay_high,
        delay_critical,
        recipient_activation_delay,
        policy_change_delay,
        recovery_delay,
        proposal_ttl,
        high_exposure_bps,
        critical_exposure_bps,
        hard_block_exposure_bps,
        envelope_bps,
        envelope_window,
    }
}

public fun approvals_low(p: &Policy): u8 { p.approvals_low }
public fun approvals_high(p: &Policy): u8 { p.approvals_high }
public fun approvals_critical(p: &Policy): u8 { p.approvals_critical }
public fun governance_threshold(p: &Policy): u8 { p.governance_threshold }
public fun guardian_threshold(p: &Policy): u8 { p.guardian_threshold }
public fun guardian_required_critical(p: &Policy): bool { p.guardian_required_critical }
public fun delay_high(p: &Policy): u64 { p.delay_high }
public fun delay_critical(p: &Policy): u64 { p.delay_critical }
public fun recipient_activation_delay(p: &Policy): u64 { p.recipient_activation_delay }
public fun policy_change_delay(p: &Policy): u64 { p.policy_change_delay }
public fun recovery_delay(p: &Policy): u64 { p.recovery_delay }
public fun proposal_ttl(p: &Policy): u64 { p.proposal_ttl }
public fun high_exposure_bps(p: &Policy): u64 { p.high_exposure_bps }
public fun critical_exposure_bps(p: &Policy): u64 { p.critical_exposure_bps }
public fun hard_block_exposure_bps(p: &Policy): u64 { p.hard_block_exposure_bps }
public fun envelope_bps(p: &Policy): u64 { p.envelope_bps }
public fun envelope_window(p: &Policy): u64 { p.envelope_window }

// ---------------------------------------------------------------- per-asset limits
public struct AssetLimits has copy, drop, store {
    /// An asset must be approved before it can be proposed at all.
    approved: bool,
    /// Above `low_max` a transfer is at least high tier; above `high_max` it is critical.
    low_max: u64,
    high_max: u64,
    /// Absolute caps. Zero means no cap.
    per_tx_max: u64,
    daily_max: u64,
}

public fun new_limits(
    approved: bool,
    low_max: u64,
    high_max: u64,
    per_tx_max: u64,
    daily_max: u64,
): AssetLimits {
    AssetLimits { approved, low_max, high_max, per_tx_max, daily_max }
}

public fun limits_approved(l: &AssetLimits): bool { l.approved }
public fun limits_low_max(l: &AssetLimits): u64 { l.low_max }
public fun limits_high_max(l: &AssetLimits): u64 { l.high_max }
public fun limits_per_tx_max(l: &AssetLimits): u64 { l.per_tx_max }
public fun limits_daily_max(l: &AssetLimits): u64 { l.daily_max }

// ---------------------------------------------------------------- validation
/// Returns `E_OK` when the policy is coherent, otherwise the first failure's code.
public fun validate(p: &Policy): u64 {
    let bps = types::bps();
    if (p.approvals_low == 0) return E_APPROVALS_LOW_ZERO;
    if (p.approvals_high < p.approvals_low) return E_APPROVALS_HIGH_BELOW_LOW;
    if (p.approvals_critical < p.approvals_high) return E_APPROVALS_CRITICAL_BELOW_HIGH;
    if (p.governance_threshold == 0) return E_GOVERNANCE_ZERO;
    if (p.guardian_required_critical && p.guardian_threshold == 0) {
        return E_GUARDIAN_REQUIRED_WITHOUT_THRESHOLD
    };
    if (p.delay_critical < p.delay_high) return E_CRITICAL_DELAY_BELOW_HIGH;
    if (p.critical_exposure_bps != 0 && p.high_exposure_bps > p.critical_exposure_bps) {
        return E_HIGH_EXPOSURE_ABOVE_CRITICAL
    };
    if (p.critical_exposure_bps > bps || p.high_exposure_bps > bps) return E_EXPOSURE_ABOVE_FULL;
    if (p.hard_block_exposure_bps != 0 && p.hard_block_exposure_bps < p.critical_exposure_bps) {
        return E_HARD_BLOCK_BELOW_CRITICAL
    };
    if (p.hard_block_exposure_bps > bps) return E_HARD_BLOCK_ABOVE_FULL;
    if (p.envelope_bps > bps) return E_ENVELOPE_ABOVE_FULL;
    if (p.envelope_bps != 0 && p.envelope_window < MIN_EXECUTION_WINDOW_MS) {
        return E_ENVELOPE_WINDOW_TOO_SHORT
    };
    if (p.proposal_ttl < longest_delay(p) + MIN_EXECUTION_WINDOW_MS) {
        return E_TTL_BELOW_LONGEST_DELAY
    };
    E_OK
}

public fun longest_delay(p: &Policy): u64 {
    let mut longest = p.delay_critical;
    if (p.policy_change_delay > longest) longest = p.policy_change_delay;
    if (p.recovery_delay > longest) longest = p.recovery_delay;
    if (p.recipient_activation_delay > longest) longest = p.recipient_activation_delay;
    longest
}

public fun assert_valid(p: &Policy) {
    let code = validate(p);
    assert!(code == E_OK, code);
}

public fun validate_limits(l: &AssetLimits): u64 {
    if (l.low_max > l.high_max) return E_LIMITS_LOW_ABOVE_HIGH;
    if (l.per_tx_max != 0 && l.daily_max != 0 && l.per_tx_max > l.daily_max) {
        return E_LIMITS_PER_TX_ABOVE_DAILY
    };
    E_OK
}

public fun assert_limits_valid(l: &AssetLimits) {
    let code = validate_limits(l);
    assert!(code == E_OK, code);
}

/// A policy is only meaningful against a real roster: a threshold nobody can reach is a frozen
/// vault, so the counts are validated together with the policy on every change to either.
public fun validate_counts(
    p: &Policy,
    owners: u64,
    approvers: u64,
    executors: u64,
    guardians: u64,
): u64 {
    if (owners < 1) return E_NO_OWNER;
    if (executors < 1) return E_NO_EXECUTOR;
    if (owners < (p.governance_threshold as u64)) return E_GOVERNANCE_EXCEEDS_OWNERS;
    if (approvers < (p.approvals_critical as u64)) return E_CRITICAL_EXCEEDS_APPROVERS;
    if (guardians < (p.guardian_threshold as u64)) {
        return E_GUARDIAN_THRESHOLD_EXCEEDS_GUARDIANS
    };
    E_OK
}

public fun assert_counts_valid(
    p: &Policy,
    owners: u64,
    approvers: u64,
    executors: u64,
    guardians: u64,
) {
    let code = validate_counts(p, owners, approvers, executors, guardians);
    assert!(code == E_OK, code);
}

// ---------------------------------------------------------------- what weakened
// One bit per field that can be loosened. The vault records the mask on the proposal, so a signer
// sees exactly which controls a policy change gives up, and a non-zero mask routes the change
// through the policy-change delay with a guardian veto.
const R_APPROVALS_LOW: u32 = 1;
const R_APPROVALS_HIGH: u32 = 1 << 1;
const R_APPROVALS_CRITICAL: u32 = 1 << 2;
const R_GOVERNANCE: u32 = 1 << 3;
const R_GUARDIAN_THRESHOLD: u32 = 1 << 4;
const R_GUARDIAN_NOT_REQUIRED: u32 = 1 << 5;
const R_DELAY_HIGH: u32 = 1 << 6;
const R_DELAY_CRITICAL: u32 = 1 << 7;
const R_ACTIVATION_DELAY: u32 = 1 << 8;
const R_POLICY_CHANGE_DELAY: u32 = 1 << 9;
const R_RECOVERY_DELAY: u32 = 1 << 10;
const R_PROPOSAL_TTL: u32 = 1 << 11;
const R_HIGH_EXPOSURE: u32 = 1 << 12;
const R_CRITICAL_EXPOSURE: u32 = 1 << 13;
const R_HARD_BLOCK: u32 = 1 << 14;
const R_ENVELOPE: u32 = 1 << 15;
const R_ENVELOPE_WINDOW: u32 = 1 << 16;

const R_ASSET_NEWLY_APPROVED: u32 = 1;
const R_LOW_MAX: u32 = 1 << 1;
const R_HIGH_MAX: u32 = 1 << 2;
const R_PER_TX_CAP: u32 = 1 << 3;
const R_DAILY_CAP: u32 = 1 << 4;

public fun r_approvals_low(): u32 { R_APPROVALS_LOW }
public fun r_guardian_not_required(): u32 { R_GUARDIAN_NOT_REQUIRED }
public fun r_envelope(): u32 { R_ENVELOPE }
public fun r_asset_newly_approved(): u32 { R_ASSET_NEWLY_APPROVED }
public fun r_daily_cap(): u32 { R_DAILY_CAP }

/// For a threshold where zero means "disabled", moving to zero is the loosest possible move and
/// moving away from zero can only tighten.
fun threshold_loosens(a: u64, b: u64): bool {
    if (a == 0) return false;
    if (b == 0) return true;
    b > a
}

/// Which controls `b` gives up relative to `a`. Zero means the change only tightens.
public fun reductions(a: &Policy, b: &Policy): u32 {
    let mut m: u32 = 0;
    if (b.approvals_low < a.approvals_low) m = m | R_APPROVALS_LOW;
    if (b.approvals_high < a.approvals_high) m = m | R_APPROVALS_HIGH;
    if (b.approvals_critical < a.approvals_critical) m = m | R_APPROVALS_CRITICAL;
    if (b.governance_threshold < a.governance_threshold) m = m | R_GOVERNANCE;
    if (b.guardian_threshold < a.guardian_threshold) m = m | R_GUARDIAN_THRESHOLD;
    if (a.guardian_required_critical && !b.guardian_required_critical) {
        m = m | R_GUARDIAN_NOT_REQUIRED
    };
    if (b.delay_high < a.delay_high) m = m | R_DELAY_HIGH;
    if (b.delay_critical < a.delay_critical) m = m | R_DELAY_CRITICAL;
    if (b.recipient_activation_delay < a.recipient_activation_delay) m = m | R_ACTIVATION_DELAY;
    if (b.policy_change_delay < a.policy_change_delay) m = m | R_POLICY_CHANGE_DELAY;
    if (b.recovery_delay < a.recovery_delay) m = m | R_RECOVERY_DELAY;
    // A longer lifetime keeps a stale approval set alive for longer, so it loosens.
    if (b.proposal_ttl > a.proposal_ttl) m = m | R_PROPOSAL_TTL;
    if (threshold_loosens(a.high_exposure_bps, b.high_exposure_bps)) m = m | R_HIGH_EXPOSURE;
    if (threshold_loosens(a.critical_exposure_bps, b.critical_exposure_bps)) {
        m = m | R_CRITICAL_EXPOSURE
    };
    if (threshold_loosens(a.hard_block_exposure_bps, b.hard_block_exposure_bps)) {
        m = m | R_HARD_BLOCK
    };
    if (threshold_loosens(a.envelope_bps, b.envelope_bps)) m = m | R_ENVELOPE;
    if (a.envelope_bps != 0 && b.envelope_window < a.envelope_window) m = m | R_ENVELOPE_WINDOW;
    m
}

public fun limit_reductions(a: &AssetLimits, b: &AssetLimits): u32 {
    let mut m: u32 = 0;
    if (!a.approved && b.approved) m = m | R_ASSET_NEWLY_APPROVED;
    if (b.low_max > a.low_max) m = m | R_LOW_MAX;
    if (b.high_max > a.high_max) m = m | R_HIGH_MAX;
    if (threshold_loosens(a.per_tx_max, b.per_tx_max)) m = m | R_PER_TX_CAP;
    if (threshold_loosens(a.daily_max, b.daily_max)) m = m | R_DAILY_CAP;
    m
}

/// Raising a recipient's trust, or lifting a restriction, is a security-reducing move; lowering it
/// is always allowed to take effect at once.
public fun trust_reduces(from: u8, to: u8): bool {
    let restricted = types::trust_restricted();
    let blocked = types::trust_blocked();
    let from_held_back = from == restricted || from == blocked || from == types::trust_unknown();
    if (from_held_back && to != restricted && to != blocked) return true;
    if (to == blocked || to == restricted) return false;
    to > from
}
