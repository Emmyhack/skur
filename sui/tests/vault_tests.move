/// End-to-end tests for the vault. Each one is written as the attack or the mistake it defends
/// against, because that is the only reason the control exists.
#[test_only]
module skur::vault_tests;

use std::string;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::test_scenario::{Self as ts, Scenario};
use skur::policy::{Self, Policy};
use skur::types;
use skur::vault::{Self, Vault};

/// A stand-in asset. `Coin<USDC>` behaves exactly like any other coin type for the vault's
/// purposes, which is the point of keying the treasury by type.
public struct USDC has drop {}

const OWNER: address = @0xA1;
const OWNER2: address = @0xA2;
const APPROVER: address = @0xA3;
const APPROVER2: address = @0xA4;
const GUARD: address = @0xB1;
const AGENT: address = @0xC1;
const BOB: address = @0xD1;
const EVE: address = @0xD2;
const NEWKEY: address = @0xE1;

const HOUR: u64 = 3_600_000;
const DAY: u64 = 86_400_000;
const T0: u64 = 1_700_000_000_000;

const TREASURY: u64 = 1_000_000;

// abort codes under test
const E_LOCKDOWN: u64 = 107;
const E_NOT_PENDING: u64 = 110;
const E_TOO_EARLY: u64 = 113;
const E_EXPIRED: u64 = 114;
const E_NOT_ENOUGH_APPROVALS: u64 = 116;
const E_NOT_ENOUGH_GUARDIANS: u64 = 117;
const E_RECIPIENT_BLOCKED: u64 = 118;
const E_RECIPIENT_IN_PROBATION: u64 = 119;
const E_PER_TX_CAP: u64 = 120;
const E_DAILY_CAP: u64 = 121;
const E_HARD_BLOCK: u64 = 122;
const E_NOT_APPROVER: u64 = 102;
const E_NOT_EXECUTOR: u64 = 103;
const E_CANNOT_PROPOSE: u64 = 105;
const E_ALREADY_VOTED: u64 = 138;

// ---------------------------------------------------------------- fixtures
fun make_policy(envelope_bps: u64, hard_block: u64, delay_high: u64): Policy {
    policy::new(
        1, 2, 3, // approvals low / high / critical
        2, // governance threshold
        1, // guardian threshold
        true, // guardian required for critical
        delay_high,
        DAY, // critical delay
        12 * HOUR, // recipient activation
        2 * DAY, // policy change
        3 * DAY, // recovery
        30 * DAY, // proposal lifetime
        1_000, // high exposure 10%
        2_500, // critical exposure 25%
        hard_block,
        envelope_bps,
        DAY, // envelope window
    )
}

fun base_policy(): Policy { make_policy(3_000, 9_000, HOUR) }

fun boot(sc: &mut Scenario, p: Policy, per_tx: u64, daily: u64, clock: &Clock) {
    ts::next_tx(sc, OWNER);
    let owner = types::role_owner() | types::role_approver() | types::role_executor();
    let mut s = vault::begin(
        string::utf8(b"Skur Treasury"),
        p,
        vector[OWNER, OWNER2, APPROVER, APPROVER2, GUARD, AGENT],
        vector[
            owner,
            owner,
            types::role_approver(),
            types::role_approver(),
            types::role_guardian(),
            types::role_proposer(),
        ],
        clock,
        sc.ctx(),
    );
    vault::setup_asset<USDC>(&mut s, true, 1_000, 10_000, per_tx, daily);
    vault::setup_recipient(&mut s, BOB, string::utf8(b"Payroll"));
    vault::finish(s, sc.ctx());
}

fun fund(sc: &mut Scenario, clock: &Clock, amount: u64) {
    ts::next_tx(sc, OWNER);
    let mut v = ts::take_shared<Vault>(sc);
    let c = coin::mint_for_testing<USDC>(amount, sc.ctx());
    vault::deposit<USDC>(&mut v, c, clock, sc.ctx());
    ts::return_shared(v);
}

fun propose(sc: &mut Scenario, who: address, amount: u64, to: address, clock: &Clock): u64 {
    ts::next_tx(sc, who);
    let mut v = ts::take_shared<Vault>(sc);
    let id = vault::propose_transfer<USDC>(
        &mut v,
        amount,
        to,
        string::utf8(b"invoice"),
        clock,
        sc.ctx(),
    );
    ts::return_shared(v);
    id
}

fun approve(sc: &mut Scenario, who: address, id: u64, clock: &Clock) {
    ts::next_tx(sc, who);
    let mut v = ts::take_shared<Vault>(sc);
    vault::approve(&mut v, id, clock, sc.ctx());
    ts::return_shared(v);
}

fun confirm(sc: &mut Scenario, who: address, id: u64, clock: &Clock) {
    ts::next_tx(sc, who);
    let mut v = ts::take_shared<Vault>(sc);
    vault::confirm(&mut v, id, clock, sc.ctx());
    ts::return_shared(v);
}

fun execute(sc: &mut Scenario, who: address, id: u64, clock: &Clock) {
    ts::next_tx(sc, who);
    let mut v = ts::take_shared<Vault>(sc);
    vault::execute_transfer<USDC>(&mut v, id, clock, sc.ctx());
    ts::return_shared(v);
}

fun balance(sc: &mut Scenario) : u64 {
    ts::next_tx(sc, OWNER);
    let v = ts::take_shared<Vault>(sc);
    let b = vault::balance_of<USDC>(&v);
    ts::return_shared(v);
    b
}

fun status(sc: &mut Scenario, id: u64): u8 {
    ts::next_tx(sc, OWNER);
    let v = ts::take_shared<Vault>(sc);
    let s = vault::proposal_status(&v, id);
    ts::return_shared(v);
    s
}

fun current_mode(sc: &mut Scenario): u8 {
    ts::next_tx(sc, OWNER);
    let v = ts::take_shared<Vault>(sc);
    let m = vault::mode(&v);
    ts::return_shared(v);
    m
}

fun tick(clock: &mut Clock, by: u64) {
    clock::set_for_testing(clock, clock::timestamp_ms(clock) + by);
}

/// Past the activation delay of the recipient seeded at setup, so routine payments are routine.
fun settled_clock(sc: &mut Scenario): Clock {
    let mut clock = clock::create_for_testing(sc.ctx());
    clock::set_for_testing(&mut clock, T0);
    clock
}

// ---------------------------------------------------------------- the ordinary case
#[test]
fun a_routine_payment_needs_one_approval_and_no_wait() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR); // the payroll address has finished activating

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    execute(&mut sc, OWNER, id, &clock);

    assert!(status(&mut sc, id) == types::status_executed(), 0);
    assert!(balance(&mut sc) == TREASURY - 500, 1);

    ts::next_tx(&mut sc, BOB);
    let paid = ts::take_from_sender<Coin<USDC>>(&sc);
    assert!(coin::value(&paid) == 500, 2);
    ts::return_to_sender(&sc, paid);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun a_preview_matches_what_the_vault_will_demand() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    ts::next_tx(&mut sc, OWNER);
    let v = ts::take_shared<Vault>(&sc);
    // 5_000 is above the routine maximum, so it is high tier: two approvals and an hour's wait.
    let (tier, reasons, _, approvals, guardians, delay) =
        vault::preview_transfer<USDC>(&v, 5_000, BOB, &clock);
    assert!(tier == types::tier_high(), 0);
    assert!(reasons & types::reason_amount_high() != 0, 1);
    assert!(approvals == 2 && guardians == 0 && delay == HOUR, 2);
    ts::return_shared(v);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun an_unknown_recipient_is_escalated_without_being_registered() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    ts::next_tx(&mut sc, OWNER);
    let v = ts::take_shared<Vault>(&sc);
    let (tier, reasons, _, approvals, _, _) =
        vault::preview_transfer<USDC>(&v, 500, EVE, &clock);
    assert!(tier == types::tier_high(), 0);
    assert!(reasons & types::reason_recipient_unknown() != 0, 1);
    assert!(approvals == 2, 2);
    ts::return_shared(v);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- stolen credentials
/// One stolen approver key cannot clear a high-tier payment, whatever it signs.
#[test]
#[expected_failure(abort_code = E_NOT_ENOUGH_APPROVALS)]
fun one_signer_cannot_clear_a_high_tier_payment() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 5_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    tick(&mut clock, 2 * HOUR);
    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// A signer removed after approving stops counting. The approval set is recounted against the
/// live roster at execution, not trusted as a tally frozen at approval time.
#[test]
#[expected_failure(abort_code = E_NOT_ENOUGH_APPROVALS)]
fun a_removed_signers_approval_stops_counting() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 5_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, APPROVER, id, &clock);

    // Owners remove the approver. Removing a role grants nothing, so it takes effect at once.
    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let gid = vault::propose_member(&mut v, APPROVER, 0, &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, gid, &clock);
    approve(&mut sc, OWNER2, gid, &clock);
    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_member(&mut v2, gid, &clock, sc.ctx());
    assert!(vault::member_roles(&v2, APPROVER) == 0, 0);
    ts::return_shared(v2);

    tick(&mut clock, 2 * HOUR);
    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_ALREADY_VOTED)]
fun an_approval_cannot_be_replayed() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 5_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_NOT_PENDING)]
fun a_payment_cannot_execute_twice() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    execute(&mut sc, OWNER, id, &clock);
    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- recipients
/// A brand-new destination cannot be paid until its activation delay has run, however many
/// signatures it collects.
#[test]
#[expected_failure(abort_code = E_TOO_EARLY)]
fun a_new_recipient_cannot_skip_activation() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, APPROVER, id, &clock);
    tick(&mut clock, 2 * HOUR); // past the tier delay, nowhere near activation
    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// A guardian can block a destination while a payment to it is already approved and waiting.
#[test]
#[expected_failure(abort_code = E_RECIPIENT_BLOCKED)]
fun a_guardian_can_block_a_recipient_mid_flight() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::guardian_restrict(&mut v, BOB, types::trust_blocked(), &clock, sc.ctx());
    ts::return_shared(v);

    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun registering_a_recipient_starts_it_at_the_restrictive_default() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::register_recipient(&mut v, EVE, string::utf8(b"Vendor"), &clock, sc.ctx());
    assert!(vault::recipient_trust(&v, EVE) == types::trust_new(), 0);
    assert!(vault::recipient_activates_at(&v, EVE) == T0 + 12 * HOUR, 1);
    ts::return_shared(v);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- caps
#[test]
#[expected_failure(abort_code = E_PER_TX_CAP)]
fun the_per_transaction_cap_refuses_at_proposal_time() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 1_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);
    propose(&mut sc, OWNER, 2_000, BOB, &clock);
    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// Splitting a withdrawal into pieces does not beat the daily cap: the day's outflow is counted
/// cumulatively, and the last piece is refused.
#[test]
#[expected_failure(abort_code = E_DAILY_CAP)]
fun splitting_a_drain_does_not_beat_the_daily_cap() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 0, 1_200, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let a = propose(&mut sc, OWNER, 600, BOB, &clock);
    approve(&mut sc, OWNER, a, &clock);
    execute(&mut sc, OWNER, a, &clock);

    // Half the day's allowance is now gone, so the next piece is escalated and waits an hour.
    let b = propose(&mut sc, OWNER, 600, BOB, &clock);
    approve(&mut sc, OWNER, b, &clock);
    approve(&mut sc, APPROVER, b, &clock);
    tick(&mut clock, 2 * HOUR);
    execute(&mut sc, OWNER, b, &clock);
    assert!(balance(&mut sc) == TREASURY - 1_200, 0);

    propose(&mut sc, OWNER, 1, BOB, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun the_daily_bucket_reopens_after_a_day() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 0, 1_200, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let a = propose(&mut sc, OWNER, 1_000, BOB, &clock);
    approve(&mut sc, OWNER, a, &clock);
    approve(&mut sc, APPROVER, a, &clock);
    tick(&mut clock, 2 * HOUR);
    execute(&mut sc, OWNER, a, &clock);

    tick(&mut clock, DAY + HOUR);
    let b = propose(&mut sc, OWNER, 1_000, BOB, &clock);
    approve(&mut sc, OWNER, b, &clock);
    approve(&mut sc, APPROVER, b, &clock);
    tick(&mut clock, 2 * HOUR);
    execute(&mut sc, OWNER, b, &clock);
    assert!(balance(&mut sc) == TREASURY - 2_000, 0);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// Above the hard block no amount of authorization is enough. It is the one control with no
/// override path at all.
#[test]
#[expected_failure(abort_code = E_HARD_BLOCK)]
fun the_hard_block_cannot_be_approved_around() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 0, 0, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);
    propose(&mut sc, OWNER, 950_000, BOB, &clock);
    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- the circuit breaker
/// The envelope is the last gate. A payment that would cross it is not made, the money stays
/// where it is, and the vault latches into Lockdown — which has to persist, so the transaction
/// succeeds rather than reverting.
#[test]
fun crossing_the_loss_envelope_freezes_the_vault_instead_of_paying() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, make_policy(1_000, 9_000, HOUR), 0, 0, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    // 200_000 is 20% of the treasury; the envelope allows 10% per day.
    let id = propose(&mut sc, OWNER, 200_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);
    approve(&mut sc, APPROVER, id, &clock);
    confirm(&mut sc, GUARD, id, &clock);
    tick(&mut clock, DAY + HOUR);
    execute(&mut sc, OWNER, id, &clock);

    assert!(status(&mut sc, id) == types::status_blocked(), 0);
    assert!(balance(&mut sc) == TREASURY, 1);
    assert!(current_mode(&mut sc) == types::mode_lockdown(), 2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_LOCKDOWN)]
fun lockdown_stops_new_payments_from_being_opened() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, make_policy(1_000, 9_000, HOUR), 0, 0, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 200_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);
    approve(&mut sc, APPROVER, id, &clock);
    confirm(&mut sc, GUARD, id, &clock);
    tick(&mut clock, DAY + HOUR);
    execute(&mut sc, OWNER, id, &clock);

    propose(&mut sc, OWNER, 100, BOB, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// Leaving Lockdown takes owners, a guardian and time, in that order. Whoever caused the freeze
/// cannot lift it alone.
#[test]
fun leaving_lockdown_takes_owners_a_guardian_and_time() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, make_policy(1_000, 9_000, HOUR), 0, 0, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 200_000, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);
    approve(&mut sc, APPROVER, id, &clock);
    confirm(&mut sc, GUARD, id, &clock);
    tick(&mut clock, DAY + HOUR);
    execute(&mut sc, OWNER, id, &clock);
    assert!(current_mode(&mut sc) == types::mode_lockdown(), 0);

    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let rid = vault::propose_mode_relax(&mut v, types::mode_normal(), &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, rid, &clock);
    approve(&mut sc, OWNER2, rid, &clock);
    confirm(&mut sc, GUARD, rid, &clock);

    tick(&mut clock, 2 * DAY + HOUR);
    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_mode_relax(&mut v2, rid, &clock, sc.ctx());
    assert!(vault::mode(&v2) == types::mode_normal(), 1);
    assert!(vault::posture_reasons(&v2) == 0, 2);
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// Every owner can agree and the freeze still holds: a guardian has to sign it off.
#[test]
#[expected_failure(abort_code = E_NOT_ENOUGH_GUARDIANS)]
fun owners_alone_cannot_lift_a_freeze() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::raise_mode(&mut v, types::mode_lockdown(), 0, &clock, sc.ctx());
    ts::return_shared(v);

    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    let rid = vault::propose_mode_relax(&mut v2, types::mode_normal(), &clock, sc.ctx());
    ts::return_shared(v2);

    approve(&mut sc, OWNER, rid, &clock);
    approve(&mut sc, OWNER2, rid, &clock);

    tick(&mut clock, 2 * DAY + HOUR);
    ts::next_tx(&mut sc, OWNER);
    let mut v3 = ts::take_shared<Vault>(&sc);
    vault::execute_mode_relax(&mut v3, rid, &clock, sc.ctx());
    ts::return_shared(v3);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- guardians
#[test]
fun a_guardian_veto_stops_a_critical_payment_and_raises_the_posture() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 20_000, BOB, &clock);
    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::veto(&mut v, id, &clock, sc.ctx());
    ts::return_shared(v);

    assert!(status(&mut sc, id) == types::status_vetoed(), 0);
    assert!(current_mode(&mut sc) == types::mode_elevated(), 1);
    assert!(balance(&mut sc) == TREASURY, 2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// A guardian has no treasury role and so no way to open a payment, let alone execute one.
#[test]
#[expected_failure(abort_code = E_CANNOT_PROPOSE)]
fun a_guardian_cannot_open_a_payment() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);
    propose(&mut sc, GUARD, 100, BOB, &clock);
    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- the agent proposer
/// An automated agent holds the proposer role: it can ask the treasury to pay, and that is all.
#[test]
fun an_agent_can_open_a_payment_that_people_still_have_to_clear() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, AGENT, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    execute(&mut sc, OWNER, id, &clock);
    assert!(status(&mut sc, id) == types::status_executed(), 0);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_NOT_APPROVER)]
fun an_agent_cannot_approve_its_own_proposal() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);
    let id = propose(&mut sc, AGENT, 500, BOB, &clock);
    approve(&mut sc, AGENT, id, &clock);
    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_NOT_EXECUTOR)]
fun an_agent_cannot_execute() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);
    let id = propose(&mut sc, AGENT, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    execute(&mut sc, AGENT, id, &clock);
    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- the policy firewall
#[test]
fun tightening_the_policy_takes_effect_as_soon_as_owners_agree() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    let tighter = make_policy(2_000, 8_000, 2 * HOUR);
    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_policy(&mut v, tighter, &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);

    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_policy(&mut v2, id, &clock, sc.ctx());
    assert!(vault::policy_version(&v2) == 2, 0);
    assert!(policy::delay_high(vault::policy(&v2)) == 2 * HOUR, 1);
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// Weakening the vault waits out the policy-change delay, even with every owner's signature.
#[test]
#[expected_failure(abort_code = E_TOO_EARLY)]
fun loosening_the_policy_has_to_wait() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    let looser = make_policy(3_000, 9_000, HOUR / 2);
    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_policy(&mut v, looser, &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);

    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_policy(&mut v2, id, &clock, sc.ctx());
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun loosening_the_policy_succeeds_once_the_delay_has_run() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    let looser = make_policy(3_000, 9_000, HOUR / 2);
    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_policy(&mut v, looser, &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);

    tick(&mut clock, 2 * DAY + HOUR);
    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_policy(&mut v2, id, &clock, sc.ctx());
    assert!(policy::delay_high(vault::policy(&v2)) == HOUR / 2, 0);
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// And a guardian can stop it outright inside that window.
#[test]
fun a_guardian_can_veto_a_weakening() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    let looser = make_policy(3_000, 9_000, HOUR / 2);
    ts::next_tx(&mut sc, OWNER);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_policy(&mut v, looser, &clock, sc.ctx());
    ts::return_shared(v);
    approve(&mut sc, OWNER, id, &clock);
    approve(&mut sc, OWNER2, id, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::veto(&mut v2, id, &clock, sc.ctx());
    ts::return_shared(v2);
    assert!(status(&mut sc, id) == types::status_vetoed(), 0);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- recovery
/// A lost key is replaced by guardians, after a delay, with the same roles and nothing else
/// changed — and the vault comes out of it in a raised posture.
#[test]
fun recovery_moves_the_roles_and_leaves_the_vault_elevated() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_recovery(&mut v, APPROVER, NEWKEY, &clock, sc.ctx());
    ts::return_shared(v);
    confirm(&mut sc, GUARD, id, &clock);

    tick(&mut clock, 3 * DAY + HOUR);
    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_recovery(&mut v2, id, &clock, sc.ctx());
    assert!(vault::member_roles(&v2, APPROVER) == 0, 0);
    assert!(vault::member_roles(&v2, NEWKEY) == types::role_approver(), 1);
    assert!(vault::policy_version(&v2) == 1, 2); // the policy is untouched
    assert!(vault::mode(&v2) == types::mode_elevated(), 3);
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_TOO_EARLY)]
fun recovery_cannot_skip_its_delay() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_recovery(&mut v, APPROVER, NEWKEY, &clock, sc.ctx());
    ts::return_shared(v);
    confirm(&mut sc, GUARD, id, &clock);

    ts::next_tx(&mut sc, OWNER);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::execute_recovery(&mut v2, id, &clock, sc.ctx());
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

/// A compromised guardian key cannot quietly install a new signer: any owner cancels it.
#[test]
fun any_owner_can_cancel_a_recovery() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    let id = vault::propose_recovery(&mut v, APPROVER, NEWKEY, &clock, sc.ctx());
    ts::return_shared(v);

    ts::next_tx(&mut sc, OWNER2);
    let mut v2 = ts::take_shared<Vault>(&sc);
    vault::cancel(&mut v2, id, &clock, sc.ctx());
    ts::return_shared(v2);
    assert!(status(&mut sc, id) == types::status_cancelled(), 0);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- lifetimes
#[test]
fun a_proposal_expires_and_cannot_be_revived() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    tick(&mut clock, 31 * DAY);

    ts::next_tx(&mut sc, EVE);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::expire(&mut v, id, &clock, sc.ctx());
    ts::return_shared(v);
    assert!(status(&mut sc, id) == types::status_expired(), 0);
    assert!(balance(&mut sc) == TREASURY, 1);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = E_EXPIRED)]
fun an_expired_proposal_cannot_execute() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    let id = propose(&mut sc, OWNER, 500, BOB, &clock);
    approve(&mut sc, OWNER, id, &clock);
    tick(&mut clock, 31 * DAY);
    execute(&mut sc, OWNER, id, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

// ---------------------------------------------------------------- posture
/// Elevated halves the caps and escalates every tier, so a vault that has seen something wrong
/// keeps running but at a lower rate.
#[test]
#[expected_failure(abort_code = E_PER_TX_CAP)]
fun elevated_halves_the_caps() {
    let mut sc = ts::begin(OWNER);
    let mut clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 1_000, 100_000, &clock);
    fund(&mut sc, &clock, TREASURY);
    tick(&mut clock, 13 * HOUR);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::raise_mode(&mut v, types::mode_elevated(), 0, &clock, sc.ctx());
    ts::return_shared(v);

    propose(&mut sc, OWNER, 800, BOB, &clock);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}

#[test]
fun deposits_are_never_gated() {
    let mut sc = ts::begin(OWNER);
    let clock = settled_clock(&mut sc);
    boot(&mut sc, base_policy(), 50_000, 100_000, &clock);

    ts::next_tx(&mut sc, GUARD);
    let mut v = ts::take_shared<Vault>(&sc);
    vault::raise_mode(&mut v, types::mode_lockdown(), 0, &clock, sc.ctx());
    ts::return_shared(v);

    // Even frozen, and even from a stranger, money can come in.
    ts::next_tx(&mut sc, EVE);
    let mut v2 = ts::take_shared<Vault>(&sc);
    let c = coin::mint_for_testing<USDC>(42, sc.ctx());
    vault::deposit<USDC>(&mut v2, c, &clock, sc.ctx());
    assert!(vault::balance_of<USDC>(&v2) == 42, 0);
    ts::return_shared(v2);

    clock::destroy_for_testing(clock);
    ts::end(sc);
}
