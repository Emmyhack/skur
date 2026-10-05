import { bcs } from '@mysten/sui/bcs';
export declare const PolicyBcs: import("@mysten/sui/bcs").BcsStruct<{
    approvals_low: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    approvals_high: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    approvals_critical: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    governance_threshold: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    guardian_threshold: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    guardian_required_critical: import("@mysten/sui/bcs").BcsType<boolean, boolean, "bool">;
    delay_high: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    delay_critical: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    recipient_activation_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    policy_change_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    recovery_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    proposal_ttl: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    high_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    critical_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    hard_block_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    envelope_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    envelope_window: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
}, string>;
export declare const AssetLimitsBcs: import("@mysten/sui/bcs").BcsStruct<{
    approved: import("@mysten/sui/bcs").BcsType<boolean, boolean, "bool">;
    low_max: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    high_max: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    per_tx_max: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    daily_max: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
}, string>;
export declare const VelocityBcs: import("@mysten/sui/bcs").BcsStruct<{
    day_anchor: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    day_spent: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    envelope_anchor: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    envelope_spent: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    envelope_basis: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
}, string>;
export declare const RecipientBcs: import("@mysten/sui/bcs").BcsStruct<{
    trust: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    registered_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    activates_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    paid_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    last_paid: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    label: import("@mysten/sui/bcs").BcsType<string, string, "string">;
}, string>;
export declare const ProposalBcs: import("@mysten/sui/bcs").BcsStruct<{
    id: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    kind: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    status: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    proposer: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    created_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    executable_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    expires_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    req_approvals: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    req_guardians: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    tier: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    reasons: import("@mysten/sui/bcs").BcsType<number, number, "u16">;
    exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    policy_version: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    reduction_mask: import("@mysten/sui/bcs").BcsType<number, number, "u32">;
    approvals: import("@mysten/sui/bcs").BcsStruct<{
        contents: import("@mysten/sui/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
    }, string>;
    confirmations: import("@mysten/sui/bcs").BcsStruct<{
        contents: import("@mysten/sui/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
    }, string>;
    rejections: import("@mysten/sui/bcs").BcsStruct<{
        contents: import("@mysten/sui/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
    }, string>;
    asset: import("@mysten/sui/bcs").BcsType<{
        name: string;
    } | null, {
        name: string;
    } | null | undefined, `Option<${string}>`>;
    amount: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    recipient: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    memo: import("@mysten/sui/bcs").BcsType<string, string, "string">;
    new_policy: import("@mysten/sui/bcs").BcsType<{
        approvals_low: number;
        approvals_high: number;
        approvals_critical: number;
        governance_threshold: number;
        guardian_threshold: number;
        guardian_required_critical: boolean;
        delay_high: string;
        delay_critical: string;
        recipient_activation_delay: string;
        policy_change_delay: string;
        recovery_delay: string;
        proposal_ttl: string;
        high_exposure_bps: string;
        critical_exposure_bps: string;
        hard_block_exposure_bps: string;
        envelope_bps: string;
        envelope_window: string;
    } | null, {
        approvals_low: number;
        approvals_high: number;
        approvals_critical: number;
        governance_threshold: number;
        guardian_threshold: number;
        guardian_required_critical: boolean;
        delay_high: string | number | bigint;
        delay_critical: string | number | bigint;
        recipient_activation_delay: string | number | bigint;
        policy_change_delay: string | number | bigint;
        recovery_delay: string | number | bigint;
        proposal_ttl: string | number | bigint;
        high_exposure_bps: string | number | bigint;
        critical_exposure_bps: string | number | bigint;
        hard_block_exposure_bps: string | number | bigint;
        envelope_bps: string | number | bigint;
        envelope_window: string | number | bigint;
    } | null | undefined, `Option<${string}>`>;
    new_limits: import("@mysten/sui/bcs").BcsType<{
        approved: boolean;
        low_max: string;
        high_max: string;
        per_tx_max: string;
        daily_max: string;
    } | null, {
        approved: boolean;
        low_max: string | number | bigint;
        high_max: string | number | bigint;
        per_tx_max: string | number | bigint;
        daily_max: string | number | bigint;
    } | null | undefined, `Option<${string}>`>;
    member: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    member_prev: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    member_roles: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    trust_level: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    target_mode: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
}, string>;
export declare const VaultBcs: import("@mysten/sui/bcs").BcsStruct<{
    id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    name: import("@mysten/sui/bcs").BcsType<string, string, "string">;
    policy: import("@mysten/sui/bcs").BcsStruct<{
        approvals_low: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
        approvals_high: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
        approvals_critical: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
        governance_threshold: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
        guardian_threshold: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
        guardian_required_critical: import("@mysten/sui/bcs").BcsType<boolean, boolean, "bool">;
        delay_high: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        delay_critical: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        recipient_activation_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        policy_change_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        recovery_delay: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        proposal_ttl: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        high_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        critical_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        hard_block_exposure_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        envelope_bps: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
        envelope_window: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    policy_version: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    mode: import("@mysten/sui/bcs").BcsType<number, number, "u8">;
    posture_reasons: import("@mysten/sui/bcs").BcsType<number, number, "u16">;
    members: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    owner_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    approver_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    executor_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    guardian_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    limits: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    funds: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    velocity: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    recipients: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    proposals: import("@mysten/sui/bcs").BcsStruct<{
        id: import("@mysten/sui/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        size: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    next_proposal: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    pending_count: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
    created_at: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
}, string>;
/** `sui::balance::Balance<T>` is a single u64 on the wire. */
export declare const BalanceBcs: import("@mysten/sui/bcs").BcsStruct<{
    value: import("@mysten/sui/bcs").BcsType<string, string | number | bigint, "u64">;
}, string>;
export { bcs };
//# sourceMappingURL=bcs.d.ts.map