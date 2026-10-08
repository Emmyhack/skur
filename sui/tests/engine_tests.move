/// Vectors for the pure engines. These pin the numbers the interfaces and the simulator rely on:
/// if a tier moves here, it moves everywhere, and this suite says so.
#[test_only]
module skur::engine_tests;

use skur::policy;
use skur::risk;
use skur::types;

const HOUR: u64 = 3_600_000;
const DAY: u64 = 86_400_000;

fun base(): policy::Policy {
    policy::new(
        1, 2, 3, // approvals low / high / critical
        2, // governance threshold
        1, // guardian threshold
        true, // guardian required for critical
        HOUR, // delay high
        DAY, // delay critical
        12 * HOUR, // recipient activation
        2 * DAY, // policy change
        3 * DAY, // recovery
        30 * DAY, // proposal ttl
        1_000, // high exposure 10%
        2_500, // critical exposure 25%
        9_000, // hard block 90%
        3_000, // envelope 30%
        DAY, // envelope window
    )
}

fun input(amount: u64, balance: u64, trust: u8, probation: bool, mode: u8): risk::RiskInput {
    risk::new_input(amount, balance, 1_000, 10_000, 0, 0, trust, probation, mode, 1_000, 2_500)
}

// ---------------------------------------------------------------- policy validation
#[test]
fun base_policy_is_valid() {
    assert!(policy::validate(&base()) == policy::e_ok(), 0);
}

#[test]
fun rejects_zero_low_approvals() {
    let p = policy::new(0, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&p) == 1, 0);
}

#[test]
fun rejects_non_monotonic_approvals() {
    let p = policy::new(3, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&p) == 2, 0);
    let q = policy::new(1, 3, 2, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&q) == 3, 0);
}

#[test]
fun rejects_guardian_required_without_guardians() {
    let p = policy::new(1, 2, 3, 2, 0, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&p) == 5, 0);
}

#[test]
fun rejects_critical_delay_below_high() {
    let p = policy::new(1, 2, 3, 2, 1, true, DAY, HOUR, 0, 0, 0, 30 * DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&p) == 6, 0);
}

#[test]
fun rejects_high_exposure_above_critical() {
    let p = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 3_000, 2_500, 0, 0, 0);
    assert!(policy::validate(&p) == 7, 0);
}

#[test]
fun rejects_hard_block_below_critical() {
    let p = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 1_000, 2_500, 2_000, 0, 0);
    assert!(policy::validate(&p) == 9, 0);
}

#[test]
fun rejects_envelope_window_under_an_hour() {
    let p = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, 30 * DAY, 0, 0, 0, 3_000, 60_000);
    assert!(policy::validate(&p) == 12, 0);
}

/// A policy whose transfers would expire before their own timelock elapses is unusable, and the
/// vault refuses to hold one.
#[test]
fun rejects_ttl_shorter_than_the_longest_delay() {
    let p = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, DAY, 0, 0, 0, 0, 0);
    assert!(policy::validate(&p) == 13, 0);
}

#[test]
fun ttl_must_clear_the_longest_delay_by_an_hour() {
    let exact = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, DAY + HOUR, 0, 0, 0, 0, 0);
    assert!(policy::validate(&exact) == policy::e_ok(), 0);
    let short = policy::new(1, 2, 3, 2, 1, true, HOUR, DAY, 0, 0, 0, DAY + HOUR - 1, 0, 0, 0, 0, 0);
    assert!(policy::validate(&short) == 13, 1);
}

#[test]
fun counts_must_satisfy_the_policy() {
    let p = base();
    assert!(policy::validate_counts(&p, 2, 3, 1, 1) == policy::e_ok(), 0);
    assert!(policy::validate_counts(&p, 0, 3, 1, 1) == 30, 1); // no owner
    assert!(policy::validate_counts(&p, 2, 3, 0, 1) == 31, 2); // no executor
    assert!(policy::validate_counts(&p, 1, 3, 1, 1) == 32, 3); // governance > owners
    assert!(policy::validate_counts(&p, 2, 2, 1, 1) == 33, 4); // critical > approvers
    assert!(policy::validate_counts(&p, 2, 3, 1, 0) == 34, 5); // guardian threshold > guardians
}

#[test]
fun limits_must_be_coherent() {
    assert!(policy::validate_limits(&policy::new_limits(true, 10, 5, 0, 0)) == 20, 0);
    assert!(policy::validate_limits(&policy::new_limits(true, 1, 5, 100, 50)) == 21, 1);
    // Zero means "no cap", so a zero daily cap cannot be below a per-transaction cap.
    assert!(
        policy::validate_limits(&policy::new_limits(true, 1, 5, 100, 0)) == policy::e_ok(),
        2,
    );
}

// ---------------------------------------------------------------- what counts as weakening
#[test]
fun tightening_reports_no_reduction() {
    let a = base();
    let b = policy::new(
        2, 3, 4, 3, 2, true, 2 * HOUR, 2 * DAY, DAY, 3 * DAY, 4 * DAY, 30 * DAY,
        500, 1_500, 8_000, 2_000, DAY,
    );
    assert!(policy::reductions(&a, &b) == 0, 0);
}

#[test]
fun fewer_approvals_is_a_reduction() {
    let a = base();
    let b = policy::new(
        1, 1, 3, 2, 1, true, HOUR, DAY, 12 * HOUR, 2 * DAY, 3 * DAY, 30 * DAY,
        1_000, 2_500, 9_000, 3_000, DAY,
    );
    assert!(policy::reductions(&a, &b) != 0, 0);
}

#[test]
fun dropping_the_guardian_requirement_is_a_reduction() {
    let a = base();
    let b = policy::new(
        1, 2, 3, 2, 1, false, HOUR, DAY, 12 * HOUR, 2 * DAY, 3 * DAY, 30 * DAY,
        1_000, 2_500, 9_000, 3_000, DAY,
    );
    assert!(policy::reductions(&a, &b) == policy::r_guardian_not_required(), 0);
}

/// Disabling a threshold by setting it to zero is the loosest move available, and must not be
/// mistaken for tightening just because the number went down.
#[test]
fun zeroing_the_envelope_is_a_reduction() {
    let a = base();
    let b = policy::new(
        1, 2, 3, 2, 1, true, HOUR, DAY, 12 * HOUR, 2 * DAY, 3 * DAY, 30 * DAY,
        1_000, 2_500, 9_000, 0, DAY,
    );
    assert!(policy::reductions(&a, &b) == policy::r_envelope(), 0);
}

#[test]
fun a_longer_proposal_lifetime_is_a_reduction() {
    let a = base();
    let b = policy::new(
        1, 2, 3, 2, 1, true, HOUR, DAY, 12 * HOUR, 2 * DAY, 3 * DAY, 60 * DAY,
        1_000, 2_500, 9_000, 3_000, DAY,
    );
    assert!(policy::reductions(&a, &b) != 0, 0);
}

#[test]
fun weakening_a_cap_to_zero_is_a_reduction() {
    let a = policy::new_limits(true, 100, 1_000, 500, 5_000);
    let b = policy::new_limits(true, 100, 1_000, 0, 5_000);
    assert!(policy::limit_reductions(&a, &b) != 0, 0);
    let c = policy::new_limits(true, 100, 1_000, 400, 5_000);
    assert!(policy::limit_reductions(&a, &c) == 0, 1);
}

#[test]
fun approving_a_new_asset_is_a_reduction() {
    let a = policy::new_limits(false, 0, 0, 0, 0);
    let b = policy::new_limits(true, 100, 1_000, 0, 0);
    assert!(policy::limit_reductions(&a, &b) & policy::r_asset_newly_approved() != 0, 0);
}

#[test]
fun lifting_a_restriction_reduces_but_imposing_one_does_not() {
    assert!(policy::trust_reduces(types::trust_restricted(), types::trust_verified()), 0);
    assert!(policy::trust_reduces(types::trust_new(), types::trust_trusted()), 1);
    assert!(!policy::trust_reduces(types::trust_trusted(), types::trust_blocked()), 2);
    assert!(!policy::trust_reduces(types::trust_verified(), types::trust_new()), 3);
}

// ---------------------------------------------------------------- roles
#[test]
fun a_guardian_cannot_hold_a_treasury_role() {
    assert!(types::roles_valid(types::role_guardian()), 0);
    assert!(types::roles_valid(types::role_owner() | types::role_approver()), 1);
    assert!(!types::roles_valid(types::role_guardian() | types::role_owner()), 2);
    assert!(!types::roles_valid(types::role_guardian() | types::role_proposer()), 3);
    assert!(!types::roles_valid(0), 4);
}

#[test]
fun a_proposer_can_only_propose() {
    let agent = types::role_proposer();
    assert!(types::can_propose(agent), 0);
    assert!(!types::has_role(agent, types::role_approver()), 1);
    assert!(!types::has_role(agent, types::role_executor()), 2);
    assert!(!types::has_role(agent, types::role_owner()), 3);
}

// ---------------------------------------------------------------- risk classification
#[test]
fun exposure_is_a_share_of_holdings() {
    assert!(risk::exposure_bps(0, 1_000) == 0, 0);
    assert!(risk::exposure_bps(100, 1_000) == 1_000, 1);
    assert!(risk::exposure_bps(1_000, 1_000) == types::bps(), 2);
    assert!(risk::exposure_bps(1_500, 1_000) == types::bps(), 3);
    // Paying out of an empty balance is full exposure, not a division by zero.
    assert!(risk::exposure_bps(5, 0) == types::bps(), 4);
}

/// Exposure is computed in 128-bit space, so a treasury large enough to overflow a naive
/// `amount * 10_000` still classifies correctly.
#[test]
fun exposure_survives_a_large_treasury() {
    let big = 1_000_000_000_000_000_000; // 1e18
    assert!(risk::exposure_bps(big / 4, big) == 2_500, 0);
}

#[test]
fun amount_sets_the_tier() {
    let low = risk::classify(&input(500, 1_000_000, types::trust_verified(), false, types::mode_normal()));
    assert!(low.tier() == types::tier_low(), 0);
    assert!(low.reasons() == 0, 1);

    let high = risk::classify(&input(5_000, 1_000_000, types::trust_verified(), false, types::mode_normal()));
    assert!(high.tier() == types::tier_high(), 2);
    assert!(high.reasons() & types::reason_amount_high() != 0, 3);

    let crit = risk::classify(&input(50_000, 10_000_000, types::trust_verified(), false, types::mode_normal()));
    assert!(crit.tier() == types::tier_critical(), 4);
    assert!(crit.reasons() & types::reason_amount_critical() != 0, 5);
}

/// A small payment out of a small treasury is still a big payment.
#[test]
fun share_of_treasury_escalates_on_its_own() {
    let o = risk::classify(&input(500, 4_000, types::trust_verified(), false, types::mode_normal()));
    assert!(o.tier() == types::tier_high(), 0);
    assert!(o.reasons() & types::reason_exposure_high() != 0, 1);

    let c = risk::classify(&input(900, 3_000, types::trust_verified(), false, types::mode_normal()));
    assert!(c.tier() == types::tier_critical(), 2);
    assert!(c.reasons() & types::reason_exposure_critical() != 0, 3);
}

#[test]
fun an_unknown_recipient_escalates_one_step() {
    let o = risk::classify(&input(500, 1_000_000, types::trust_unknown(), false, types::mode_normal()));
    assert!(o.tier() == types::tier_high(), 0);
    assert!(o.reasons() & types::reason_recipient_unknown() != 0, 1);

    // Already high on amount, an unknown recipient takes it to critical.
    let c = risk::classify(&input(5_000, 1_000_000, types::trust_unknown(), false, types::mode_normal()));
    assert!(c.tier() == types::tier_critical(), 2);
}

#[test]
fun probation_escalates_only_until_it_elapses() {
    let during = risk::classify(&input(500, 1_000_000, types::trust_new(), true, types::mode_normal()));
    assert!(during.tier() == types::tier_high(), 0);
    assert!(during.reasons() & types::reason_recipient_probation() != 0, 1);

    let after = risk::classify(&input(500, 1_000_000, types::trust_new(), false, types::mode_normal()));
    assert!(after.tier() == types::tier_low(), 2);
}

#[test]
fun a_restricted_recipient_is_always_critical() {
    let o = risk::classify(&input(1, 1_000_000_000, types::trust_restricted(), false, types::mode_normal()));
    assert!(o.tier() == types::tier_critical(), 0);
    assert!(o.reasons() & types::reason_recipient_restricted() != 0, 1);
}

#[test]
fun trusted_recipients_are_never_discounted_below_the_amount_tier() {
    let o = risk::classify(&input(50_000, 10_000_000, types::trust_trusted(), false, types::mode_normal()));
    assert!(o.tier() == types::tier_critical(), 0);
}

/// Crossing half the day's allowance escalates, so splitting a drain hits the higher bar partway
/// through rather than never.
#[test]
fun velocity_pressure_escalates_mid_drain() {
    let quiet = risk::new_input(
        100, 1_000_000, 1_000, 10_000, 10_000, 0,
        types::trust_verified(), false, types::mode_normal(), 1_000, 2_500,
    );
    assert!(risk::classify(&quiet).tier() == types::tier_low(), 0);

    let pressured = risk::new_input(
        100, 1_000_000, 1_000, 10_000, 10_000, 5_000,
        types::trust_verified(), false, types::mode_normal(), 1_000, 2_500,
    );
    let o = risk::classify(&pressured);
    assert!(o.tier() == types::tier_high(), 1);
    assert!(o.reasons() & types::reason_velocity_pressure() != 0, 2);
}

#[test]
fun elevated_mode_escalates_everything() {
    let o = risk::classify(&input(500, 1_000_000, types::trust_verified(), false, types::mode_elevated()));
    assert!(o.tier() == types::tier_high(), 0);
    assert!(o.reasons() & types::reason_mode_elevated() != 0, 1);

    let c = risk::classify(&input(5_000, 1_000_000, types::trust_verified(), false, types::mode_elevated()));
    assert!(c.tier() == types::tier_critical(), 2);
}

/// Several signals at once, each recorded, so a reviewer sees every reason and not just the
/// loudest one.
#[test]
fun reasons_accumulate() {
    let i = risk::new_input(
        5_000, 20_000, 1_000, 10_000, 10_000, 6_000,
        types::trust_unknown(), true, types::mode_elevated(), 1_000, 2_500,
    );
    let o = risk::classify(&i);
    assert!(o.tier() == types::tier_critical(), 0);
    assert!(o.reasons() & types::reason_amount_high() != 0, 1);
    assert!(o.reasons() & types::reason_exposure_critical() != 0, 2);
    assert!(o.reasons() & types::reason_recipient_unknown() != 0, 3);
    assert!(o.reasons() & types::reason_velocity_pressure() != 0, 4);
    assert!(o.reasons() & types::reason_mode_elevated() != 0, 5);
}

#[test]
fun requirements_follow_the_tier() {
    let p = base();
    let (a, g, d) = risk::requirements(&p, types::tier_low());
    assert!(a == 1 && g == 0 && d == 0, 0);
    let (a2, g2, d2) = risk::requirements(&p, types::tier_high());
    assert!(a2 == 2 && g2 == 0 && d2 == HOUR, 1);
    let (a3, g3, d3) = risk::requirements(&p, types::tier_critical());
    assert!(a3 == 3 && g3 == 1 && d3 == DAY, 2);
}

#[test]
fun elevated_halves_the_caps_but_never_to_zero() {
    let (p, d) = risk::effective_caps(1_000, 10_000, types::mode_elevated());
    assert!(p == 500 && d == 5_000, 0);
    let (p2, d2) = risk::effective_caps(1, 1, types::mode_elevated());
    assert!(p2 == 1 && d2 == 1, 1);
    // No cap stays no cap; halving zero would silently freeze the asset.
    let (p3, d3) = risk::effective_caps(0, 0, types::mode_elevated());
    assert!(p3 == 0 && d3 == 0, 2);
    let (p4, d4) = risk::effective_caps(1_000, 10_000, types::mode_normal());
    assert!(p4 == 1_000 && d4 == 10_000, 3);
}
