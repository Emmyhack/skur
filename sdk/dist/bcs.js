import { bcs } from '@mysten/sui/bcs';
/**
 * BCS layouts for the Move structs, in declaration order. BCS is positional, so these must match
 * `sui/sources/*.move` field for field — reordering a field in Move without reordering it here
 * silently misreads every vault.
 *
 * Parsed over the `content` bytes from `getObject({ include: { content: true } })`, which is the
 * stable representation. The `json` include is explicitly documented as not guaranteed across
 * clients, so nothing here uses it.
 */
/** `sui::object::UID` is a single 32-byte id on the wire. */
const UID = bcs.Address;
/** `sui::table::Table` and `sui::bag::Bag` both serialise as a handle plus a count. */
const Handle = bcs.struct('Handle', { id: UID, size: bcs.u64() });
const TypeNameBcs = bcs.struct('TypeName', { name: bcs.string() });
const VecSetAddress = bcs.struct('VecSet<address>', {
    contents: bcs.vector(bcs.Address),
});
export const PolicyBcs = bcs.struct('Policy', {
    approvals_low: bcs.u8(),
    approvals_high: bcs.u8(),
    approvals_critical: bcs.u8(),
    governance_threshold: bcs.u8(),
    guardian_threshold: bcs.u8(),
    guardian_required_critical: bcs.bool(),
    delay_high: bcs.u64(),
    delay_critical: bcs.u64(),
    recipient_activation_delay: bcs.u64(),
    policy_change_delay: bcs.u64(),
    recovery_delay: bcs.u64(),
    proposal_ttl: bcs.u64(),
    high_exposure_bps: bcs.u64(),
    critical_exposure_bps: bcs.u64(),
    hard_block_exposure_bps: bcs.u64(),
    envelope_bps: bcs.u64(),
    envelope_window: bcs.u64(),
});
export const AssetLimitsBcs = bcs.struct('AssetLimits', {
    approved: bcs.bool(),
    low_max: bcs.u64(),
    high_max: bcs.u64(),
    per_tx_max: bcs.u64(),
    daily_max: bcs.u64(),
});
export const VelocityBcs = bcs.struct('Velocity', {
    day_anchor: bcs.u64(),
    day_spent: bcs.u64(),
    envelope_anchor: bcs.u64(),
    envelope_spent: bcs.u64(),
    envelope_basis: bcs.u64(),
});
export const RecipientBcs = bcs.struct('Recipient', {
    trust: bcs.u8(),
    registered_at: bcs.u64(),
    activates_at: bcs.u64(),
    paid_count: bcs.u64(),
    last_paid: bcs.u64(),
    label: bcs.string(),
});
export const ProposalBcs = bcs.struct('Proposal', {
    id: bcs.u64(),
    kind: bcs.u8(),
    status: bcs.u8(),
    proposer: bcs.Address,
    created_at: bcs.u64(),
    executable_at: bcs.u64(),
    expires_at: bcs.u64(),
    req_approvals: bcs.u8(),
    req_guardians: bcs.u8(),
    tier: bcs.u8(),
    reasons: bcs.u16(),
    exposure_bps: bcs.u64(),
    policy_version: bcs.u64(),
    reduction_mask: bcs.u32(),
    approvals: VecSetAddress,
    confirmations: VecSetAddress,
    asset: bcs.option(TypeNameBcs),
    amount: bcs.u64(),
    recipient: bcs.Address,
    memo: bcs.string(),
    new_policy: bcs.option(PolicyBcs),
    new_limits: bcs.option(AssetLimitsBcs),
    member: bcs.Address,
    member_prev: bcs.Address,
    member_roles: bcs.u8(),
    trust_level: bcs.u8(),
    target_mode: bcs.u8(),
});
export const VaultBcs = bcs.struct('Vault', {
    id: UID,
    name: bcs.string(),
    policy: PolicyBcs,
    policy_version: bcs.u64(),
    mode: bcs.u8(),
    posture_reasons: bcs.u16(),
    members: Handle,
    owner_count: bcs.u64(),
    approver_count: bcs.u64(),
    executor_count: bcs.u64(),
    guardian_count: bcs.u64(),
    limits: Handle,
    funds: Handle,
    velocity: Handle,
    recipients: Handle,
    proposals: Handle,
    next_proposal: bcs.u64(),
    pending_count: bcs.u64(),
    created_at: bcs.u64(),
});
/** `sui::balance::Balance<T>` is a single u64 on the wire. */
export const BalanceBcs = bcs.struct('Balance', { value: bcs.u64() });
/** A `Table` entry is stored as `Field<K, V>` under the table's own id. */
export function fieldBcs(key, value) {
    return { key, value };
}
export { bcs };
//# sourceMappingURL=bcs.js.map