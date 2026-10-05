/// The Skur vault: a shared object that holds a treasury and will only let it move when the
/// policy, the recipient's standing, the day's outflow, the loss envelope and the vault's own
/// security posture all agree.
///
/// A plain multisig answers one question — did k of n sign? A Skur vault answers a harder one:
/// given everything that has happened recently, *should* this payment go out right now, and if so
/// how much authorization does it need? Every control below is enforced here, in Move, not in an
/// interface or a backend.
module skur::vault;

use std::string::{Self, String};
use std::type_name::{Self, TypeName};
use sui::bag::{Self, Bag};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};
use sui::vec_set::{Self, VecSet};
use skur::policy::{Self, Policy, AssetLimits};
use skur::risk;
use skur::types;

// ---------------------------------------------------------------- errors
const E_NOT_MEMBER: u64 = 100;
const E_NOT_OWNER: u64 = 101;
const E_NOT_APPROVER: u64 = 102;
const E_NOT_EXECUTOR: u64 = 103;
const E_NOT_GUARDIAN: u64 = 104;
const E_CANNOT_PROPOSE: u64 = 105;
const E_INVALID_ROLES: u64 = 106;
const E_LOCKDOWN: u64 = 107;
const E_ASSET_NOT_APPROVED: u64 = 108;
const E_UNKNOWN_PROPOSAL: u64 = 109;
const E_NOT_PENDING: u64 = 110;
const E_WRONG_KIND: u64 = 111;
const E_WRONG_ASSET: u64 = 112;
const E_TOO_EARLY: u64 = 113;
const E_EXPIRED: u64 = 114;
const E_NOT_EXPIRED: u64 = 115;
const E_NOT_ENOUGH_APPROVALS: u64 = 116;
const E_NOT_ENOUGH_GUARDIANS: u64 = 117;
const E_RECIPIENT_BLOCKED: u64 = 118;
const E_RECIPIENT_IN_PROBATION: u64 = 119;
const E_PER_TX_CAP: u64 = 120;
const E_DAILY_CAP: u64 = 121;
const E_HARD_BLOCK: u64 = 122;
const E_INSUFFICIENT_BALANCE: u64 = 123;
const E_ZERO_AMOUNT: u64 = 124;
const E_NOT_VETOABLE: u64 = 125;
const E_ALREADY_REGISTERED: u64 = 126;
const E_INVALID_TRUST: u64 = 128;
const E_INVALID_MODE: u64 = 129;
const E_NOT_A_RELAXATION: u64 = 130;
const E_NOT_PROPOSER_OR_OWNER: u64 = 131;
const E_GUARDIAN_HAS_TREASURY_ROLE: u64 = 133;
const E_ASSET_ALREADY_SET_UP: u64 = 134;
const E_ROSTER_MISMATCH: u64 = 135;
const E_SELF_RECOVERY: u64 = 136;
const E_NO_SUCH_MEMBER: u64 = 137;

// ---------------------------------------------------------------- state
/// Cumulative outflow, counted per asset in anchored windows.
///
/// The envelope is measured against `envelope_basis`, the balance when the window opened, not the
/// live balance. Measuring against the live balance would let a drain shrink its own denominator
/// and keep every later transfer under the same percentage.
public struct Velocity has copy, drop, store {
    day_anchor: u64,
    day_spent: u64,
    envelope_anchor: u64,
    envelope_spent: u64,
    envelope_basis: u64,
}

/// A payment destination and how much the vault trusts it.
public struct Recipient has copy, drop, store {
    trust: u8,
    registered_at: u64,
    /// Until this moment the recipient is in probation and every payment is escalated.
    activates_at: u64,
    paid_count: u64,
    last_paid: u64,
    label: String,
}

/// One pending or settled request. Every kind shares the same lifecycle — propose, approve,
/// optionally confirm, wait, execute — so there is exactly one path through which anything
/// changes, and exactly one place where the final checks run.
public struct Proposal has store {
    id: u64,
    kind: u8,
    status: u8,
    proposer: address,
    created_at: u64,
    /// Not executable before this moment: the tier's timelock, and for a new recipient, their
    /// activation time, whichever is later.
    executable_at: u64,
    expires_at: u64,
    /// Requirements pinned when the proposal was opened. At execution the live requirements are
    /// recomputed and the stricter of the two applies, so tightening the policy affects proposals
    /// already in flight while loosening it cannot rescue one.
    req_approvals: u8,
    req_guardians: u8,
    tier: u8,
    reasons: u16,
    exposure_bps: u64,
    policy_version: u64,
    /// Which controls this proposal would give up. Non-zero routes it through the policy-change
    /// delay and makes it vetoable.
    reduction_mask: u32,
    approvals: VecSet<address>,
    confirmations: VecSet<address>,
    /// Signers who have turned it down. Settled once this reaches `req_approvals`.
    rejections: VecSet<address>,
    // transfer payload
    asset: Option<TypeName>,
    amount: u64,
    recipient: address,
    memo: String,
    // governance payloads
    new_policy: Option<Policy>,
    new_limits: Option<AssetLimits>,
    member: address,
    member_prev: address,
    member_roles: u8,
    trust_level: u8,
    target_mode: u8,
}

public struct Vault has key, store {
    id: UID,
    name: String,
    policy: Policy,
    /// Bumped on every policy change, so a proposal can tell whether the rules moved under it.
    policy_version: u64,
    mode: u8,
    /// Why the vault last escalated its posture; a bitmask of `types::reason_*`.
    posture_reasons: u16,
    members: Table<address, u8>,
    owner_count: u64,
    approver_count: u64,
    executor_count: u64,
    guardian_count: u64,
    limits: Table<TypeName, AssetLimits>,
    /// `TypeName` -> `Balance<T>`. One vault holds every asset the organization approved.
    funds: Bag,
    velocity: Table<TypeName, Velocity>,
    recipients: Table<address, Recipient>,
    proposals: Table<u64, Proposal>,
    next_proposal: u64,
    pending_count: u64,
    created_at: u64,
}

// ---------------------------------------------------------------- events
public struct VaultCreated has copy, drop {
    vault: ID,
    name: String,
    creator: address,
    owner_count: u64,
    guardian_count: u64,
    at: u64,
}

public struct Deposited has copy, drop {
    vault: ID,
    asset: TypeName,
    amount: u64,
    balance: u64,
    from: address,
    at: u64,
}

public struct ProposalOpened has copy, drop {
    vault: ID,
    proposal: u64,
    kind: u8,
    proposer: address,
    asset: Option<TypeName>,
    amount: u64,
    recipient: address,
    tier: u8,
    reasons: u16,
    exposure_bps: u64,
    req_approvals: u8,
    req_guardians: u8,
    executable_at: u64,
    expires_at: u64,
    reduction_mask: u32,
    memo: String,
    at: u64,
}

public struct Approved has copy, drop {
    vault: ID,
    proposal: u64,
    approver: address,
    approvals: u64,
    req_approvals: u8,
    at: u64,
}

public struct Rejected has copy, drop {
    vault: ID,
    proposal: u64,
    rejecter: address,
    rejections: u64,
    req_approvals: u8,
    settled: bool,
    at: u64,
}

public struct Confirmed has copy, drop {
    vault: ID,
    proposal: u64,
    guardian: address,
    confirmations: u64,
    req_guardians: u8,
    at: u64,
}

public struct Settled has copy, drop {
    vault: ID,
    proposal: u64,
    kind: u8,
    status: u8,
    actor: address,
    at: u64,
}

public struct Executed has copy, drop {
    vault: ID,
    proposal: u64,
    kind: u8,
    asset: Option<TypeName>,
    amount: u64,
    recipient: address,
    executor: address,
    tier: u8,
    balance_after: u64,
    day_spent: u64,
    at: u64,
}

/// The breaker refused a transfer that was otherwise fully authorized.
public struct BreakerTripped has copy, drop {
    vault: ID,
    proposal: u64,
    asset: TypeName,
    amount: u64,
    envelope_spent: u64,
    envelope_limit: u64,
    envelope_basis: u64,
    at: u64,
}

public struct ModeChanged has copy, drop {
    vault: ID,
    from: u8,
    to: u8,
    actor: address,
    reasons: u16,
    at: u64,
}

public struct PolicyChanged has copy, drop {
    vault: ID,
    proposal: u64,
    version: u64,
    reduction_mask: u32,
    at: u64,
}

public struct LimitsChanged has copy, drop {
    vault: ID,
    proposal: u64,
    asset: TypeName,
    approved: bool,
    low_max: u64,
    high_max: u64,
    per_tx_max: u64,
    daily_max: u64,
    reduction_mask: u32,
    at: u64,
}

public struct MemberChanged has copy, drop {
    vault: ID,
    proposal: u64,
    member: address,
    roles_before: u8,
    roles_after: u8,
    at: u64,
}

public struct RecipientRegistered has copy, drop {
    vault: ID,
    recipient: address,
    trust: u8,
    activates_at: u64,
    label: String,
    actor: address,
    at: u64,
}

public struct RecipientTrustChanged has copy, drop {
    vault: ID,
    proposal: u64,
    recipient: address,
    from: u8,
    to: u8,
    actor: address,
    at: u64,
}

public struct Recovered has copy, drop {
    vault: ID,
    proposal: u64,
    lost: address,
    replacement: address,
    roles: u8,
    at: u64,
}

// ---------------------------------------------------------------- creation
/// A vault under construction. It has no abilities, so the transaction that opened it must also
/// finish it: `begin`, then any number of `setup_asset` / `setup_recipient` calls, then `finish`,
/// all in one programmable transaction block. There is no window in which a half-configured
/// vault is reachable by anyone.
public struct VaultSetup {
    vault: Vault,
}

public fun begin(
    name: String,
    policy: Policy,
    members: vector<address>,
    roles: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): VaultSetup {
    assert!(members.length() == roles.length(), E_ROSTER_MISMATCH);
    policy.assert_valid();
    let now = clock::timestamp_ms(clock);

    let mut vault = Vault {
        id: object::new(ctx),
        name,
        policy,
        policy_version: 1,
        mode: types::mode_normal(),
        posture_reasons: 0,
        members: table::new(ctx),
        owner_count: 0,
        approver_count: 0,
        executor_count: 0,
        guardian_count: 0,
        limits: table::new(ctx),
        funds: bag::new(ctx),
        velocity: table::new(ctx),
        recipients: table::new(ctx),
        proposals: table::new(ctx),
        next_proposal: 1,
        pending_count: 0,
        created_at: now,
    };

    let mut i = 0;
    while (i < members.length()) {
        let who = members[i];
        let bits = roles[i];
        assert!(types::roles_valid(bits), E_INVALID_ROLES);
        assert!(!vault.members.contains(who), E_ALREADY_REGISTERED);
        vault.members.add(who, bits);
        tally(&mut vault, bits, true);
        i = i + 1;
    };

    VaultSetup { vault }
}

/// Approve an asset the vault may hold and pay out, with its tier boundaries and caps.
public fun setup_asset<T>(
    s: &mut VaultSetup,
    approved: bool,
    low_max: u64,
    high_max: u64,
    per_tx_max: u64,
    daily_max: u64,
) {
    let key = type_name::get<T>();
    assert!(!s.vault.limits.contains(key), E_ASSET_ALREADY_SET_UP);
    let limits = policy::new_limits(approved, low_max, high_max, per_tx_max, daily_max);
    limits.assert_limits_valid();
    s.vault.limits.add(key, limits);
    s.vault.velocity.add(key, Velocity {
        day_anchor: s.vault.created_at,
        day_spent: 0,
        envelope_anchor: s.vault.created_at,
        envelope_spent: 0,
        envelope_basis: 0,
    });
}

/// Seed the address book. Recipients added at setup still serve their activation delay, so a
/// vault cannot be created with a pre-trusted drain address that is immediately cheap to pay.
public fun setup_recipient(s: &mut VaultSetup, who: address, label: String) {
    assert!(!s.vault.recipients.contains(who), E_ALREADY_REGISTERED);
    let activates_at = s.vault.created_at + s.vault.policy.recipient_activation_delay();
    s.vault.recipients.add(who, Recipient {
        trust: types::trust_new(),
        registered_at: s.vault.created_at,
        activates_at,
        paid_count: 0,
        last_paid: 0,
        label,
    });
}

/// Validate the finished roster against the policy and publish the vault as a shared object.
public fun finish(s: VaultSetup, ctx: &TxContext) {
    let VaultSetup { vault } = s;
    vault.policy.assert_counts_valid(
        vault.owner_count,
        vault.approver_count,
        vault.executor_count,
        vault.guardian_count,
    );
    event::emit(VaultCreated {
        vault: object::id(&vault),
        name: vault.name,
        creator: ctx.sender(),
        owner_count: vault.owner_count,
        guardian_count: vault.guardian_count,
        at: vault.created_at,
    });
    transfer::share_object(vault);
}

// ---------------------------------------------------------------- roster bookkeeping
fun tally(v: &mut Vault, bits: u8, add: bool) {
    if (types::has_role(bits, types::role_owner())) {
        v.owner_count = if (add) v.owner_count + 1 else v.owner_count - 1;
    };
    if (types::has_role(bits, types::role_approver())) {
        v.approver_count = if (add) v.approver_count + 1 else v.approver_count - 1;
    };
    if (types::has_role(bits, types::role_executor())) {
        v.executor_count = if (add) v.executor_count + 1 else v.executor_count - 1;
    };
    if (types::has_role(bits, types::role_guardian())) {
        v.guardian_count = if (add) v.guardian_count + 1 else v.guardian_count - 1;
    };
}

fun roles_of(v: &Vault, who: address): u8 {
    if (v.members.contains(who)) *v.members.borrow(who) else 0
}

fun assert_role(v: &Vault, who: address, role: u8, code: u64) {
    assert!(types::has_role(roles_of(v, who), role), code);
}

fun assert_not_lockdown(v: &Vault) {
    assert!(v.mode != types::mode_lockdown(), E_LOCKDOWN);
}

// ---------------------------------------------------------------- read access
public fun name(v: &Vault): String { v.name }
public fun policy(v: &Vault): &Policy { &v.policy }
public fun policy_version(v: &Vault): u64 { v.policy_version }
public fun mode(v: &Vault): u8 { v.mode }
public fun posture_reasons(v: &Vault): u16 { v.posture_reasons }
public fun owner_count(v: &Vault): u64 { v.owner_count }
public fun approver_count(v: &Vault): u64 { v.approver_count }
public fun executor_count(v: &Vault): u64 { v.executor_count }
public fun guardian_count(v: &Vault): u64 { v.guardian_count }
public fun pending_count(v: &Vault): u64 { v.pending_count }
public fun proposal_count(v: &Vault): u64 { v.next_proposal - 1 }
public fun member_roles(v: &Vault, who: address): u8 { roles_of(v, who) }

public fun balance_of<T>(v: &Vault): u64 {
    let key = type_name::get<T>();
    if (!bag::contains(&v.funds, key)) return 0;
    balance::value(bag::borrow<TypeName, Balance<T>>(&v.funds, key))
}

public fun limits_of<T>(v: &Vault): AssetLimits {
    let key = type_name::get<T>();
    if (!v.limits.contains(key)) {
        policy::new_limits(false, 0, 0, 0, 0)
    } else {
        *v.limits.borrow(key)
    }
}

public fun recipient_trust(v: &Vault, who: address): u8 {
    if (!v.recipients.contains(who)) return types::trust_unknown();
    v.recipients.borrow(who).trust
}

public fun recipient_activates_at(v: &Vault, who: address): u64 {
    if (!v.recipients.contains(who)) return 0;
    v.recipients.borrow(who).activates_at
}

/// Day spent and envelope spent for an asset, after rolling any window that has already closed.
public fun outflow_of<T>(v: &Vault, clock: &Clock): (u64, u64) {
    let key = type_name::get<T>();
    if (!v.velocity.contains(key)) return (0, 0);
    let vel = *v.velocity.borrow(key);
    let now = clock::timestamp_ms(clock);
    let day = if (now >= vel.day_anchor + types::day_ms()) 0 else vel.day_spent;
    let window = v.policy.envelope_window();
    let env = if (window != 0 && now >= vel.envelope_anchor + window) 0 else vel.envelope_spent;
    (day, env)
}

public fun proposal_status(v: &Vault, id: u64): u8 {
    if (!v.proposals.contains(id)) return 0;
    v.proposals.borrow(id).status
}

public fun proposal_approvals(v: &Vault, id: u64): u64 {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    v.proposals.borrow(id).approvals.size()
}

public fun proposal_confirmations(v: &Vault, id: u64): u64 {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    v.proposals.borrow(id).confirmations.size()
}

public fun proposal_rejections(v: &Vault, id: u64): u64 {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    v.proposals.borrow(id).rejections.size()
}

/// Approvals that would still count right now: a removed signer's approval is not one.
public fun live_approvals(v: &Vault, id: u64): u64 {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    count_live(v, &v.proposals.borrow(id).approvals, types::role_approver())
}

public fun live_confirmations(v: &Vault, id: u64): u64 {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    count_live(v, &v.proposals.borrow(id).confirmations, types::role_guardian())
}

fun count_live(v: &Vault, set: &VecSet<address>, role: u8): u64 {
    let keys = set.keys();
    let mut n = 0;
    let mut i = 0;
    while (i < keys.length()) {
        if (types::has_role(roles_of(v, keys[i]), role)) n = n + 1;
        i = i + 1;
    };
    n
}

// ---------------------------------------------------------------- deposits
/// Anyone may fund an approved asset. Deposits are never gated: the controls exist to govern money
/// leaving, and refusing incoming funds would only strand them.
public fun deposit<T>(v: &mut Vault, c: Coin<T>, clock: &Clock, ctx: &TxContext) {
    let key = type_name::get<T>();
    assert!(v.limits.contains(key) && v.limits.borrow(key).limits_approved(), E_ASSET_NOT_APPROVED);
    let amount = c.value();
    assert!(amount > 0, E_ZERO_AMOUNT);
    let incoming = c.into_balance();
    if (bag::contains(&v.funds, key)) {
        balance::join(bag::borrow_mut<TypeName, Balance<T>>(&mut v.funds, key), incoming);
    } else {
        bag::add(&mut v.funds, key, incoming);
    };
    event::emit(Deposited {
        vault: object::id(v),
        asset: key,
        amount,
        balance: balance_of<T>(v),
        from: ctx.sender(),
        at: clock::timestamp_ms(clock),
    });
}

// ---------------------------------------------------------------- recipients
/// Any owner may add a recipient at the restrictive default: trust `NEW`, serving an activation
/// delay. Raising trust beyond that is a governance action with a timelock.
public fun register_recipient(
    v: &mut Vault,
    who: address,
    label: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_not_lockdown(v);
    assert_role(v, ctx.sender(), types::role_owner(), E_NOT_OWNER);
    assert!(!v.recipients.contains(who), E_ALREADY_REGISTERED);
    let now = clock::timestamp_ms(clock);
    let activates_at = now + v.policy.recipient_activation_delay();
    v.recipients.add(who, Recipient {
        trust: types::trust_new(),
        registered_at: now,
        activates_at,
        paid_count: 0,
        last_paid: 0,
        label,
    });
    event::emit(RecipientRegistered {
        vault: object::id(v),
        recipient: who,
        trust: types::trust_new(),
        activates_at,
        label,
        actor: ctx.sender(),
        at: now,
    });
}

/// A guardian may block or restrict a recipient immediately and alone. This is the one unilateral
/// power in the system and it can only ever stop money, never move it.
public fun guardian_restrict(
    v: &mut Vault,
    who: address,
    to: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_role(v, ctx.sender(), types::role_guardian(), E_NOT_GUARDIAN);
    assert!(to == types::trust_restricted() || to == types::trust_blocked(), E_INVALID_TRUST);
    let now = clock::timestamp_ms(clock);
    let from = if (v.recipients.contains(who)) {
        let r = v.recipients.borrow_mut(who);
        let before = r.trust;
        r.trust = to;
        before
    } else {
        v.recipients.add(who, Recipient {
            trust: to,
            registered_at: now,
            activates_at: now,
            paid_count: 0,
            last_paid: 0,
            label: string::utf8(b""),
        });
        types::trust_unknown()
    };
    event::emit(RecipientTrustChanged {
        vault: object::id(v),
        proposal: 0,
        recipient: who,
        from,
        to,
        actor: ctx.sender(),
        at: now,
    });
}

// ---------------------------------------------------------------- security modes
/// Any owner or guardian may raise the posture at once; a guardian may go straight to Lockdown.
/// Lowering it is never unilateral — see `propose_mode_relax`.
public fun raise_mode(v: &mut Vault, to: u8, reasons: u16, clock: &Clock, ctx: &TxContext) {
    let bits = roles_of(v, ctx.sender());
    assert!(bits != 0, E_NOT_MEMBER);
    assert!(to == types::mode_elevated() || to == types::mode_lockdown(), E_INVALID_MODE);
    assert!(to > v.mode, E_NOT_A_RELAXATION);
    if (to == types::mode_lockdown()) {
        assert!(
            types::has_role(bits, types::role_guardian())
                || types::has_role(bits, types::role_owner()),
            E_NOT_GUARDIAN,
        );
    } else {
        assert!(types::has_any(bits, types::role_treasury_mask() | types::role_guardian()), E_NOT_MEMBER);
    };
    set_mode(v, to, reasons, ctx.sender(), clock);
}

fun set_mode(v: &mut Vault, to: u8, reasons: u16, actor: address, clock: &Clock) {
    let from = v.mode;
    if (from == to) return;
    v.mode = to;
    v.posture_reasons = if (to == types::mode_normal()) 0 else v.posture_reasons | reasons;
    event::emit(ModeChanged {
        vault: object::id(v),
        from,
        to,
        actor,
        reasons,
        at: clock::timestamp_ms(clock),
    });
}

const E_ALREADY_VOTED: u64 = 138;
const E_NOT_A_MEMBER_CHANGE: u64 = 139;

// ---------------------------------------------------------------- proposal plumbing
fun count_with_role(v: &Vault, keys: &vector<address>, role: u8): u64 {
    let mut n = 0;
    let mut i = 0;
    while (i < keys.length()) {
        if (types::has_role(roles_of(v, keys[i]), role)) n = n + 1;
        i = i + 1;
    };
    n
}

fun blank(
    id: u64,
    kind: u8,
    proposer: address,
    now: u64,
    executable_at: u64,
    expires_at: u64,
    req_approvals: u8,
    req_guardians: u8,
    policy_version: u64,
    reduction_mask: u32,
): Proposal {
    Proposal {
        id,
        kind,
        status: types::status_pending(),
        proposer,
        created_at: now,
        executable_at,
        expires_at,
        req_approvals,
        req_guardians,
        tier: types::tier_low(),
        reasons: 0,
        exposure_bps: 0,
        policy_version,
        reduction_mask,
        approvals: vec_set::empty(),
        confirmations: vec_set::empty(),
        rejections: vec_set::empty(),
        asset: option::none(),
        amount: 0,
        recipient: @0x0,
        memo: string::utf8(b""),
        new_policy: option::none(),
        new_limits: option::none(),
        member: @0x0,
        member_prev: @0x0,
        member_roles: 0,
        trust_level: 0,
        target_mode: 0,
    }
}

fun larger(a: u8, b: u8): u8 { if (a > b) a else b }
fun later(a: u64, b: u64): u64 { if (a > b) a else b }

/// Common checks for anyone acting on a live proposal.
fun assert_live(v: &Vault, id: u64, now: u64) {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    let p = v.proposals.borrow(id);
    assert!(p.status == types::status_pending(), E_NOT_PENDING);
    assert!(now < p.expires_at, E_EXPIRED);
}

fun settle(v: &mut Vault, id: u64, status: u8, actor: address, now: u64) {
    let kind = {
        let p = v.proposals.borrow_mut(id);
        p.status = status;
        p.kind
    };
    v.pending_count = v.pending_count - 1;
    event::emit(Settled { vault: object::id(v), proposal: id, kind, status, actor, at: now });
}

// ---------------------------------------------------------------- opening a transfer
/// Score a payment and open it for approval. Everything that can refuse the payment outright is
/// checked here *and* again at execution, because the state it reads can change in between.
public fun propose_transfer<T>(
    v: &mut Vault,
    amount: u64,
    recipient: address,
    memo: String,
    clock: &Clock,
    ctx: &mut TxContext,
): u64 {
    assert_not_lockdown(v);
    let sender = ctx.sender();
    assert!(types::can_propose(roles_of(v, sender)), E_CANNOT_PROPOSE);
    assert!(amount > 0, E_ZERO_AMOUNT);

    let key = type_name::get<T>();
    assert!(v.limits.contains(key) && v.limits.borrow(key).limits_approved(), E_ASSET_NOT_APPROVED);

    let now = clock::timestamp_ms(clock);
    let limits = limits_of<T>(v);
    let asset_balance = balance_of<T>(v);
    let trust = recipient_trust(v, recipient);
    assert!(trust != types::trust_blocked(), E_RECIPIENT_BLOCKED);

    let (per_tx, daily) = risk::effective_caps(
        limits.limits_per_tx_max(),
        limits.limits_daily_max(),
        v.mode,
    );
    assert!(per_tx == 0 || amount <= per_tx, E_PER_TX_CAP);
    let (day_spent, _) = outflow_of<T>(v, clock);
    assert!(daily == 0 || day_spent + amount <= daily, E_DAILY_CAP);

    let hard_block = v.policy.hard_block_exposure_bps();
    let exposure = risk::exposure_bps(amount, asset_balance);
    assert!(hard_block == 0 || exposure < hard_block, E_HARD_BLOCK);

    let activates_at = recipient_activates_at(v, recipient);
    let input = risk::new_input(
        amount,
        asset_balance,
        limits.limits_low_max(),
        limits.limits_high_max(),
        daily,
        day_spent,
        trust,
        now < activates_at,
        v.mode,
        v.policy.high_exposure_bps(),
        v.policy.critical_exposure_bps(),
    );
    let assessment = risk::classify(&input);
    let (req_approvals, req_guardians, delay) = risk::requirements(&v.policy, assessment.tier());

    // A new recipient's activation delay is a floor on execution, not a separate wait: the two
    // run concurrently and the later one governs.
    let executable_at = later(now + delay, activates_at);
    let expires_at = now + v.policy.proposal_ttl();

    let id = v.next_proposal;
    v.next_proposal = id + 1;
    let mut p = blank(
        id,
        types::kind_transfer(),
        sender,
        now,
        executable_at,
        expires_at,
        req_approvals,
        req_guardians,
        v.policy_version,
        0,
    );
    p.asset = option::some(key);
    p.amount = amount;
    p.recipient = recipient;
    p.memo = memo;
    p.tier = assessment.tier();
    p.reasons = assessment.reasons();
    p.exposure_bps = assessment.exposure();
    v.proposals.add(id, p);
    v.pending_count = v.pending_count + 1;

    event::emit(ProposalOpened {
        vault: object::id(v),
        proposal: id,
        kind: types::kind_transfer(),
        proposer: sender,
        asset: option::some(key),
        amount,
        recipient,
        tier: assessment.tier(),
        reasons: assessment.reasons(),
        exposure_bps: assessment.exposure(),
        req_approvals,
        req_guardians,
        executable_at,
        expires_at,
        reduction_mask: 0,
        memo,
        at: now,
    });
    id
}

/// What a transfer would cost before anyone commits to it. Pure, and identical to the logic
/// `propose_transfer` and `execute_transfer` run, so a preview cannot overpromise.
public fun preview_transfer<T>(
    v: &Vault,
    amount: u64,
    recipient: address,
    clock: &Clock,
): (u8, u16, u64, u8, u8, u64) {
    let limits = limits_of<T>(v);
    let (day_spent, _) = outflow_of<T>(v, clock);
    let now = clock::timestamp_ms(clock);
    let (_, daily) = risk::effective_caps(
        limits.limits_per_tx_max(),
        limits.limits_daily_max(),
        v.mode,
    );
    let input = risk::new_input(
        amount,
        balance_of<T>(v),
        limits.limits_low_max(),
        limits.limits_high_max(),
        daily,
        day_spent,
        recipient_trust(v, recipient),
        now < recipient_activates_at(v, recipient),
        v.mode,
        v.policy.high_exposure_bps(),
        v.policy.critical_exposure_bps(),
    );
    let a = risk::classify(&input);
    let (req_approvals, req_guardians, delay) = risk::requirements(&v.policy, a.tier());
    (a.tier(), a.reasons(), a.exposure(), req_approvals, req_guardians, delay)
}

// ---------------------------------------------------------------- voting
/// Approvers approve payments; owners approve governance. One signer, one approval, and the
/// approval is recorded against the address so a removed signer's vote stops counting.
public fun approve(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    assert_live(v, id, now);
    let sender = ctx.sender();
    let kind = v.proposals.borrow(id).kind;
    let role = if (kind == types::kind_transfer()) {
        types::role_approver()
    } else {
        types::role_owner()
    };
    let code = if (kind == types::kind_transfer()) E_NOT_APPROVER else E_NOT_OWNER;
    assert_role(v, sender, role, code);

    let (count, req) = {
        let p = v.proposals.borrow_mut(id);
        assert!(!p.approvals.contains(&sender), E_ALREADY_VOTED);
        p.approvals.insert(sender);
        (p.approvals.size(), p.req_approvals)
    };
    event::emit(Approved {
        vault: object::id(v),
        proposal: id,
        approver: sender,
        approvals: count,
        req_approvals: req,
        at: now,
    });
}

/// Turn a proposal down.
///
/// Takes the same role that approving it would, and it takes as many rejections as the proposal
/// needed approvals — so rejecting is exactly as hard as approving, and one signer cannot block
/// the queue on their own. Without this the only ways to clear a bad proposal are an owner
/// cancelling it or waiting out its lifetime.
public fun reject(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    assert_live(v, id, now);
    let sender = ctx.sender();
    let kind = v.proposals.borrow(id).kind;
    let role = if (kind == types::kind_transfer()) {
        types::role_approver()
    } else {
        types::role_owner()
    };
    let code = if (kind == types::kind_transfer()) E_NOT_APPROVER else E_NOT_OWNER;
    assert_role(v, sender, role, code);

    let (keys, req) = {
        let p = v.proposals.borrow_mut(id);
        assert!(!p.rejections.contains(&sender), E_ALREADY_VOTED);
        p.rejections.insert(sender);
        (*p.rejections.keys(), p.req_approvals)
    };
    // Counted against live roles, for the same reason approvals are.
    //
    // A recovery pins zero approvals, because what it needs is guardian confirmations. Flooring
    // the threshold at one keeps rejection meaningful there instead of settling on an empty set —
    // which matches the documented rule that any owner can stop a recovery.
    let threshold = if (req == 0) 1 else (req as u64);
    let live = count_with_role(v, &keys, role);
    let settled = live >= threshold;
    event::emit(Rejected {
        vault: object::id(v),
        proposal: id,
        rejecter: sender,
        rejections: live,
        req_approvals: req,
        settled,
        at: now,
    });
    if (settled) settle(v, id, types::status_rejected(), sender, now);
}

/// A guardian's positive signature, required for critical transfers, recovery and leaving a
/// raised posture.
public fun confirm(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    assert_live(v, id, now);
    let sender = ctx.sender();
    assert_role(v, sender, types::role_guardian(), E_NOT_GUARDIAN);
    let (count, req) = {
        let p = v.proposals.borrow_mut(id);
        assert!(!p.confirmations.contains(&sender), E_ALREADY_VOTED);
        p.confirmations.insert(sender);
        (p.confirmations.size(), p.req_guardians)
    };
    event::emit(Confirmed {
        vault: object::id(v),
        proposal: id,
        guardian: sender,
        confirmations: count,
        req_guardians: req,
        at: now,
    });
}

/// A guardian stops a critical transfer, any weakening of the vault, a recovery or a relaxation —
/// alone, and without ever gaining a way to move funds. Vetoing also raises the posture, because
/// a guardian reaching for the brake is itself a signal.
public fun veto(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    assert_live(v, id, now);
    let sender = ctx.sender();
    assert_role(v, sender, types::role_guardian(), E_NOT_GUARDIAN);
    {
        let p = v.proposals.borrow(id);
        let vetoable = p.reduction_mask != 0
            || (p.kind == types::kind_transfer() && p.tier == types::tier_critical())
            || p.kind == types::kind_recovery()
            || p.kind == types::kind_mode_relax();
        assert!(vetoable, E_NOT_VETOABLE);
    };
    settle(v, id, types::status_vetoed(), sender, now);
    if (v.mode == types::mode_normal()) {
        set_mode(v, types::mode_elevated(), types::reason_mode_elevated(), sender, clock);
    };
}

/// The proposer withdraws their own request; any owner can withdraw anyone's.
public fun cancel(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    assert_live(v, id, now);
    let sender = ctx.sender();
    let is_proposer = v.proposals.borrow(id).proposer == sender;
    assert!(
        is_proposer || types::has_role(roles_of(v, sender), types::role_owner()),
        E_NOT_PROPOSER_OR_OWNER,
    );
    settle(v, id, types::status_cancelled(), sender, now);
}

/// Anyone may retire a proposal whose lifetime has run out, so a stale approval set cannot sit
/// waiting to be reused.
public fun expire(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    let now = clock::timestamp_ms(clock);
    {
        let p = v.proposals.borrow(id);
        assert!(p.status == types::status_pending(), E_NOT_PENDING);
        assert!(now >= p.expires_at, E_NOT_EXPIRED);
    };
    settle(v, id, types::status_expired(), ctx.sender(), now);
}

// ---------------------------------------------------------------- executing a transfer
/// The last gate. Every condition is re-evaluated against the state as it is *now*, not as it was
/// when the proposal was opened:
///
/// * the approval set is recounted against live roles, so a removed signer no longer counts;
/// * the payment is reclassified, and the stricter of the pinned and live requirements applies;
/// * the recipient's trust and activation are re-read;
/// * the caps and the hard block are re-applied against the live balance and the live day;
/// * the loss envelope is checked last, and if the payment would cross it the vault latches into
///   Lockdown instead of paying.
public fun execute_transfer<T>(v: &mut Vault, id: u64, clock: &Clock, ctx: &mut TxContext) {
    let sender = ctx.sender();
    assert_role(v, sender, types::role_executor(), E_NOT_EXECUTOR);
    assert_not_lockdown(v);
    assert!(v.proposals.contains(id), E_UNKNOWN_PROPOSAL);
    let now = clock::timestamp_ms(clock);
    let key = type_name::get<T>();

    let (
        kind,
        status,
        created_at,
        executable_at,
        expires_at,
        pin_approvals,
        pin_guardians,
        amount,
        recipient,
        asset,
    ) = {
        let p = v.proposals.borrow(id);
        (
            p.kind,
            p.status,
            p.created_at,
            p.executable_at,
            p.expires_at,
            p.req_approvals,
            p.req_guardians,
            p.amount,
            p.recipient,
            p.asset,
        )
    };
    assert!(kind == types::kind_transfer(), E_WRONG_KIND);
    assert!(status == types::status_pending(), E_NOT_PENDING);
    assert!(asset.is_some() && *asset.borrow() == key, E_WRONG_ASSET);
    assert!(now < expires_at, E_EXPIRED);

    // The asset must still be approved: revoking approval stops payments already in flight.
    assert!(v.limits.contains(key) && v.limits.borrow(key).limits_approved(), E_ASSET_NOT_APPROVED);

    let asset_balance = balance_of<T>(v);
    assert!(asset_balance >= amount, E_INSUFFICIENT_BALANCE);

    let trust = recipient_trust(v, recipient);
    assert!(trust != types::trust_blocked(), E_RECIPIENT_BLOCKED);
    let activates_at = recipient_activates_at(v, recipient);
    assert!(now >= activates_at, E_RECIPIENT_IN_PROBATION);

    let limits = limits_of<T>(v);
    let (per_tx, daily) = risk::effective_caps(
        limits.limits_per_tx_max(),
        limits.limits_daily_max(),
        v.mode,
    );
    assert!(per_tx == 0 || amount <= per_tx, E_PER_TX_CAP);
    let (day_spent, _) = outflow_of<T>(v, clock);
    assert!(daily == 0 || day_spent + amount <= daily, E_DAILY_CAP);

    let hard_block = v.policy.hard_block_exposure_bps();
    let exposure = risk::exposure_bps(amount, asset_balance);
    assert!(hard_block == 0 || exposure < hard_block, E_HARD_BLOCK);

    // Reclassify, then take the stricter of what was pinned and what the rules now demand.
    let input = risk::new_input(
        amount,
        asset_balance,
        limits.limits_low_max(),
        limits.limits_high_max(),
        daily,
        day_spent,
        trust,
        false,
        v.mode,
        v.policy.high_exposure_bps(),
        v.policy.critical_exposure_bps(),
    );
    let assessment = risk::classify(&input);
    let (live_approvals_req, live_guardians_req, live_delay) =
        risk::requirements(&v.policy, assessment.tier());
    let need_approvals = larger(pin_approvals, live_approvals_req);
    let need_guardians = larger(pin_guardians, live_guardians_req);
    assert!(now >= later(executable_at, created_at + live_delay), E_TOO_EARLY);

    let approval_keys = *v.proposals.borrow(id).approvals.keys();
    let confirm_keys = *v.proposals.borrow(id).confirmations.keys();
    assert!(
        count_with_role(v, &approval_keys, types::role_approver()) >= (need_approvals as u64),
        E_NOT_ENOUGH_APPROVALS,
    );
    assert!(
        count_with_role(v, &confirm_keys, types::role_guardian()) >= (need_guardians as u64),
        E_NOT_ENOUGH_GUARDIANS,
    );

    // The circuit breaker, checked last and charged atomically with the payment.
    let envelope_bps = v.policy.envelope_bps();
    let window = v.policy.envelope_window();
    let (tripped, envelope_spent, envelope_limit, envelope_basis, day_after) = {
        let vel = v.velocity.borrow_mut(key);
        if (now >= vel.day_anchor + types::day_ms()) {
            vel.day_anchor = now;
            vel.day_spent = 0;
        };
        if (window != 0 && now >= vel.envelope_anchor + window) {
            vel.envelope_anchor = now;
            vel.envelope_spent = 0;
            vel.envelope_basis = asset_balance;
        };
        // The first charge of the vault's life opens the window against today's balance.
        if (vel.envelope_basis == 0) vel.envelope_basis = asset_balance;

        let basis = vel.envelope_basis;
        let spent = vel.envelope_spent;
        let limit = if (envelope_bps == 0) {
            0
        } else {
            (((basis as u128) * (envelope_bps as u128)) / (types::bps() as u128)) as u64
        };
        if (envelope_bps != 0 && (spent as u128) + (amount as u128) > (limit as u128)) {
            (true, spent, limit, basis, 0)
        } else {
            vel.envelope_spent = spent + amount;
            vel.day_spent = vel.day_spent + amount;
            (false, vel.envelope_spent, limit, basis, vel.day_spent)
        }
    };

    if (tripped) {
        // Not an abort: the latch has to survive the attempt, so the transaction succeeds, the
        // money stays, and the vault is frozen for everyone until owners and guardians agree to
        // reopen it.
        settle(v, id, types::status_blocked(), sender, now);
        event::emit(BreakerTripped {
            vault: object::id(v),
            proposal: id,
            asset: key,
            amount,
            envelope_spent,
            envelope_limit,
            envelope_basis,
            at: now,
        });
        set_mode(
            v,
            types::mode_lockdown(),
            types::reason_envelope_pressure() | types::reason_velocity_pressure(),
            sender,
            clock,
        );
        return
    };

    // Effects before the transfer: the proposal is spent before any value moves.
    {
        let p = v.proposals.borrow_mut(id);
        p.status = types::status_executed();
        p.tier = assessment.tier();
        p.reasons = assessment.reasons();
        p.exposure_bps = exposure;
    };
    v.pending_count = v.pending_count - 1;
    if (v.recipients.contains(recipient)) {
        let r = v.recipients.borrow_mut(recipient);
        r.paid_count = r.paid_count + 1;
        r.last_paid = now;
    };

    let paid = balance::split(bag::borrow_mut<TypeName, Balance<T>>(&mut v.funds, key), amount);
    transfer::public_transfer(coin::from_balance(paid, ctx), recipient);

    event::emit(Executed {
        vault: object::id(v),
        proposal: id,
        kind: types::kind_transfer(),
        asset: option::some(key),
        amount,
        recipient,
        executor: sender,
        tier: assessment.tier(),
        balance_after: balance_of<T>(v),
        day_spent: day_after,
        at: now,
    });
}

// ---------------------------------------------------------------- governance
/// Governance proposals share one authorization rule: owner approvals up to the governance
/// threshold, and if the change gives anything up, the policy-change delay plus a guardian veto
/// window on top. A change that only tightens the vault takes effect as soon as owners agree.
fun open_governance(
    v: &mut Vault,
    kind: u8,
    reduction_mask: u32,
    delay: u64,
    now: u64,
    sender: address,
): u64 {
    assert_role(v, sender, types::role_owner(), E_NOT_OWNER);
    // A vault in Lockdown cannot be talked into weakening itself.
    if (reduction_mask != 0) assert_not_lockdown(v);
    let id = v.next_proposal;
    v.next_proposal = id + 1;
    let p = blank(
        id,
        kind,
        sender,
        now,
        now + delay,
        now + v.policy.proposal_ttl(),
        v.policy.governance_threshold(),
        0,
        v.policy_version,
        reduction_mask,
    );
    v.proposals.add(id, p);
    v.pending_count = v.pending_count + 1;
    id
}

fun emit_opened(v: &Vault, id: u64, kind: u8, sender: address, mask: u32, memo: String) {
    let p = v.proposals.borrow(id);
    event::emit(ProposalOpened {
        vault: object::id(v),
        proposal: id,
        kind,
        proposer: sender,
        asset: p.asset,
        amount: p.amount,
        recipient: p.recipient,
        tier: types::tier_low(),
        reasons: 0,
        exposure_bps: 0,
        req_approvals: p.req_approvals,
        req_guardians: p.req_guardians,
        executable_at: p.executable_at,
        expires_at: p.expires_at,
        reduction_mask: mask,
        memo,
        at: p.created_at,
    });
}

/// Shared final check for every governance kind.
fun authorize_governance(v: &Vault, id: u64, kind: u8, now: u64): u32 {
    let p = v.proposals.borrow(id);
    assert!(p.kind == kind, E_WRONG_KIND);
    assert!(p.status == types::status_pending(), E_NOT_PENDING);
    assert!(now < p.expires_at, E_EXPIRED);
    assert!(now >= p.executable_at, E_TOO_EARLY);
    let keys = *p.approvals.keys();
    assert!(
        count_with_role(v, &keys, types::role_owner())
            >= (v.policy.governance_threshold() as u64),
        E_NOT_ENOUGH_APPROVALS,
    );
    p.reduction_mask
}

// --- the policy itself
public fun propose_policy(
    v: &mut Vault,
    next: Policy,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    next.assert_valid();
    next.assert_counts_valid(v.owner_count, v.approver_count, v.executor_count, v.guardian_count);
    let mask = policy::reductions(&v.policy, &next);
    let now = clock::timestamp_ms(clock);
    let delay = if (mask == 0) 0 else v.policy.policy_change_delay();
    let id = open_governance(v, types::kind_policy_update(), mask, delay, now, ctx.sender());
    v.proposals.borrow_mut(id).new_policy = option::some(next);
    emit_opened(v, id, types::kind_policy_update(), ctx.sender(), mask, string::utf8(b"policy"));
    id
}

public fun execute_policy(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    let mask = authorize_governance(v, id, types::kind_policy_update(), now);
    let next = *v.proposals.borrow(id).new_policy.borrow();
    // Re-validated against the roster as it stands now, not as it stood when proposed.
    next.assert_valid();
    next.assert_counts_valid(v.owner_count, v.approver_count, v.executor_count, v.guardian_count);
    v.policy = next;
    v.policy_version = v.policy_version + 1;
    settle(v, id, types::status_executed(), ctx.sender(), now);
    event::emit(PolicyChanged {
        vault: object::id(v),
        proposal: id,
        version: v.policy_version,
        reduction_mask: mask,
        at: now,
    });
}

// --- per-asset limits
public fun propose_asset_limits<T>(
    v: &mut Vault,
    approved: bool,
    low_max: u64,
    high_max: u64,
    per_tx_max: u64,
    daily_max: u64,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    let next = policy::new_limits(approved, low_max, high_max, per_tx_max, daily_max);
    next.assert_limits_valid();
    let key = type_name::get<T>();
    let current = limits_of<T>(v);
    let mask = policy::limit_reductions(&current, &next);
    let now = clock::timestamp_ms(clock);
    let delay = if (mask == 0) 0 else v.policy.policy_change_delay();
    let id = open_governance(v, types::kind_asset_limits(), mask, delay, now, ctx.sender());
    {
        let p = v.proposals.borrow_mut(id);
        p.new_limits = option::some(next);
        p.asset = option::some(key);
    };
    emit_opened(v, id, types::kind_asset_limits(), ctx.sender(), mask, string::utf8(b"limits"));
    id
}

public fun execute_asset_limits<T>(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    let key = type_name::get<T>();
    let mask = authorize_governance(v, id, types::kind_asset_limits(), now);
    let next = {
        let p = v.proposals.borrow(id);
        assert!(p.asset.is_some() && *p.asset.borrow() == key, E_WRONG_ASSET);
        *p.new_limits.borrow()
    };
    if (v.limits.contains(key)) {
        *v.limits.borrow_mut(key) = next;
    } else {
        v.limits.add(key, next);
        v.velocity.add(key, Velocity {
            day_anchor: now,
            day_spent: 0,
            envelope_anchor: now,
            envelope_spent: 0,
            envelope_basis: 0,
        });
    };
    settle(v, id, types::status_executed(), ctx.sender(), now);
    event::emit(LimitsChanged {
        vault: object::id(v),
        proposal: id,
        asset: key,
        approved: next.limits_approved(),
        low_max: next.limits_low_max(),
        high_max: next.limits_high_max(),
        per_tx_max: next.limits_per_tx_max(),
        daily_max: next.limits_daily_max(),
        reduction_mask: mask,
        at: now,
    });
}

// --- the roster
/// Set a member's roles. Zero removes them. Granting any role an address did not already hold is
/// treated as security-reducing: a new key is a new way in, so it waits and can be vetoed.
public fun propose_member(
    v: &mut Vault,
    who: address,
    roles: u8,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    assert!(roles == 0 || types::roles_valid(roles), E_INVALID_ROLES);
    let before = roles_of(v, who);
    assert!(before != roles, E_NOT_A_MEMBER_CHANGE);
    let granted = roles & (before ^ 255);
    let mask: u32 = if (granted != 0) 1 else 0;
    let now = clock::timestamp_ms(clock);
    let delay = if (mask == 0) 0 else v.policy.policy_change_delay();
    let id = open_governance(v, types::kind_member_set(), mask, delay, now, ctx.sender());
    {
        let p = v.proposals.borrow_mut(id);
        p.member = who;
        p.member_roles = roles;
    };
    emit_opened(v, id, types::kind_member_set(), ctx.sender(), mask, string::utf8(b"member"));
    id
}

public fun execute_member(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    authorize_governance(v, id, types::kind_member_set(), now);
    let (who, roles) = {
        let p = v.proposals.borrow(id);
        (p.member, p.member_roles)
    };
    let before = apply_roles(v, who, roles);
    // The roster must still satisfy the policy after the change, so a vault can never be left
    // with a threshold nobody can reach.
    v.policy.assert_counts_valid(
        v.owner_count,
        v.approver_count,
        v.executor_count,
        v.guardian_count,
    );
    settle(v, id, types::status_executed(), ctx.sender(), now);
    event::emit(MemberChanged {
        vault: object::id(v),
        proposal: id,
        member: who,
        roles_before: before,
        roles_after: roles,
        at: now,
    });
}

fun apply_roles(v: &mut Vault, who: address, roles: u8): u8 {
    let before = roles_of(v, who);
    if (before != 0) {
        tally(v, before, false);
        v.members.remove(who);
    };
    if (roles != 0) {
        assert!(types::roles_valid(roles), E_GUARDIAN_HAS_TREASURY_ROLE);
        v.members.add(who, roles);
        tally(v, roles, true);
    };
    before
}

// --- recipient trust
public fun propose_recipient_trust(
    v: &mut Vault,
    who: address,
    to: u8,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    assert!(types::trust_valid(to), E_INVALID_TRUST);
    let from = recipient_trust(v, who);
    let mask: u32 = if (policy::trust_reduces(from, to)) 1 else 0;
    let now = clock::timestamp_ms(clock);
    let delay = if (mask == 0) 0 else v.policy.policy_change_delay();
    let id = open_governance(v, types::kind_recipient_trust(), mask, delay, now, ctx.sender());
    {
        let p = v.proposals.borrow_mut(id);
        p.recipient = who;
        p.trust_level = to;
    };
    emit_opened(v, id, types::kind_recipient_trust(), ctx.sender(), mask, string::utf8(b"trust"));
    id
}

public fun execute_recipient_trust(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    authorize_governance(v, id, types::kind_recipient_trust(), now);
    let (who, to) = {
        let p = v.proposals.borrow(id);
        (p.recipient, p.trust_level)
    };
    let from = if (v.recipients.contains(who)) {
        let r = v.recipients.borrow_mut(who);
        let before = r.trust;
        r.trust = to;
        before
    } else {
        v.recipients.add(who, Recipient {
            trust: to,
            registered_at: now,
            activates_at: now + v.policy.recipient_activation_delay(),
            paid_count: 0,
            last_paid: 0,
            label: string::utf8(b""),
        });
        types::trust_unknown()
    };
    settle(v, id, types::status_executed(), ctx.sender(), now);
    event::emit(RecipientTrustChanged {
        vault: object::id(v),
        proposal: id,
        recipient: who,
        from,
        to,
        actor: ctx.sender(),
        at: now,
    });
}

// --- leaving a raised posture
/// Lowering the posture takes owners, guardians and time, in that order. Nothing about a frozen
/// vault can be undone by whoever froze it alone.
public fun propose_mode_relax(
    v: &mut Vault,
    to: u8,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    assert!(to < v.mode, E_NOT_A_RELAXATION);
    let now = clock::timestamp_ms(clock);
    let sender = ctx.sender();
    assert_role(v, sender, types::role_owner(), E_NOT_OWNER);
    let id = v.next_proposal;
    v.next_proposal = id + 1;
    let mut p = blank(
        id,
        types::kind_mode_relax(),
        sender,
        now,
        now + v.policy.policy_change_delay(),
        now + v.policy.proposal_ttl(),
        v.policy.governance_threshold(),
        v.policy.guardian_threshold(),
        v.policy_version,
        1,
    );
    p.target_mode = to;
    v.proposals.add(id, p);
    v.pending_count = v.pending_count + 1;
    emit_opened(v, id, types::kind_mode_relax(), sender, 1, string::utf8(b"relax"));
    id
}

public fun execute_mode_relax(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    let (to, approval_keys, confirm_keys) = {
        let p = v.proposals.borrow(id);
        assert!(p.kind == types::kind_mode_relax(), E_WRONG_KIND);
        assert!(p.status == types::status_pending(), E_NOT_PENDING);
        assert!(now < p.expires_at, E_EXPIRED);
        assert!(now >= p.executable_at, E_TOO_EARLY);
        (p.target_mode, *p.approvals.keys(), *p.confirmations.keys())
    };
    assert!(
        count_with_role(v, &approval_keys, types::role_owner())
            >= (v.policy.governance_threshold() as u64),
        E_NOT_ENOUGH_APPROVALS,
    );
    assert!(
        count_with_role(v, &confirm_keys, types::role_guardian())
            >= (v.policy.guardian_threshold() as u64),
        E_NOT_ENOUGH_GUARDIANS,
    );
    assert!(to < v.mode, E_NOT_A_RELAXATION);
    settle(v, id, types::status_executed(), ctx.sender(), now);
    set_mode(v, to, 0, ctx.sender(), clock);
}

// --- recovery
/// Replace a signer whose key is gone. Guardians propose it, the recovery delay runs, any owner
/// can cancel it, the roles move across unchanged, the policy is untouched, and the vault comes
/// out of it in Elevated — because a recovery means something went wrong.
public fun propose_recovery(
    v: &mut Vault,
    lost: address,
    replacement: address,
    clock: &Clock,
    ctx: &TxContext,
): u64 {
    let sender = ctx.sender();
    assert_role(v, sender, types::role_guardian(), E_NOT_GUARDIAN);
    assert!(replacement != sender, E_SELF_RECOVERY);
    assert!(roles_of(v, lost) != 0, E_NO_SUCH_MEMBER);
    assert!(roles_of(v, replacement) == 0, E_ALREADY_REGISTERED);
    let now = clock::timestamp_ms(clock);
    let id = v.next_proposal;
    v.next_proposal = id + 1;
    let mut p = blank(
        id,
        types::kind_recovery(),
        sender,
        now,
        now + v.policy.recovery_delay(),
        now + v.policy.proposal_ttl(),
        0,
        v.policy.guardian_threshold(),
        v.policy_version,
        1,
    );
    p.member_prev = lost;
    p.member = replacement;
    p.member_roles = roles_of(v, lost);
    v.proposals.add(id, p);
    v.pending_count = v.pending_count + 1;
    emit_opened(v, id, types::kind_recovery(), sender, 1, string::utf8(b"recovery"));
    id
}

public fun execute_recovery(v: &mut Vault, id: u64, clock: &Clock, ctx: &TxContext) {
    let now = clock::timestamp_ms(clock);
    let (lost, replacement, confirm_keys) = {
        let p = v.proposals.borrow(id);
        assert!(p.kind == types::kind_recovery(), E_WRONG_KIND);
        assert!(p.status == types::status_pending(), E_NOT_PENDING);
        assert!(now < p.expires_at, E_EXPIRED);
        assert!(now >= p.executable_at, E_TOO_EARLY);
        (p.member_prev, p.member, *p.confirmations.keys())
    };
    assert!(
        count_with_role(v, &confirm_keys, types::role_guardian())
            >= (v.policy.guardian_threshold() as u64),
        E_NOT_ENOUGH_GUARDIANS,
    );
    // The roles are whatever the lost signer holds at this moment, not what they held when the
    // recovery was proposed, so a recovery cannot be used to hand over roles acquired since.
    let roles = roles_of(v, lost);
    assert!(roles != 0, E_NO_SUCH_MEMBER);
    assert!(roles_of(v, replacement) == 0, E_ALREADY_REGISTERED);
    apply_roles(v, lost, 0);
    apply_roles(v, replacement, roles);
    v.policy.assert_counts_valid(
        v.owner_count,
        v.approver_count,
        v.executor_count,
        v.guardian_count,
    );
    settle(v, id, types::status_executed(), ctx.sender(), now);
    event::emit(Recovered {
        vault: object::id(v),
        proposal: id,
        lost,
        replacement,
        roles,
        at: now,
    });
    if (v.mode == types::mode_normal()) {
        set_mode(v, types::mode_elevated(), types::reason_mode_elevated(), ctx.sender(), clock);
    };
}
