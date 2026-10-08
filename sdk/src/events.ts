import type { ClientWithCoreApi } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { AssetLimitsBcs, PolicyBcs } from './bcs.js';
import { moveType } from './network.js';
import type { Kind, Mode, Status, Tier, Trust } from './types.js';

/**
 * The vault's events, which are the whole history. Every state change emits one, so an indexer or
 * a notification service never has to diff object versions to know what happened.
 *
 * Parsed from `event.bcs`, not `event.json`: the SDK documents the JSON shape as varying between
 * transports, and an audit trail cannot depend on which endpoint read it.
 */

const UID = bcs.Address;
const OptionTypeName = bcs.option(bcs.struct('TypeName', { name: bcs.string() }));

function typeName(v: { name: string } | null): string | null {
  if (!v) return null;
  return v.name.startsWith('0x') ? v.name : `0x${v.name}`;
}

export const EVENT_NAMES = [
  'VaultCreated',
  'Deposited',
  'ProposalOpened',
  'Approved',
  'Rejected',
  'Confirmed',
  'Settled',
  'Executed',
  'BreakerTripped',
  'ModeChanged',
  'PolicyChanged',
  'LimitsChanged',
  'MemberChanged',
  'RecipientRegistered',
  'RecipientTrustChanged',
  'Recovered',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const VaultCreatedBcs = bcs.struct('VaultCreated', {
  vault: UID,
  name: bcs.string(),
  creator: bcs.Address,
  owner_count: bcs.u64(),
  guardian_count: bcs.u64(),
  at: bcs.u64(),
});

const DepositedBcs = bcs.struct('Deposited', {
  vault: UID,
  asset: bcs.struct('TypeName', { name: bcs.string() }),
  amount: bcs.u64(),
  balance: bcs.u64(),
  from: bcs.Address,
  at: bcs.u64(),
});

const ProposalOpenedBcs = bcs.struct('ProposalOpened', {
  vault: UID,
  proposal: bcs.u64(),
  kind: bcs.u8(),
  proposer: bcs.Address,
  asset: OptionTypeName,
  amount: bcs.u64(),
  recipient: bcs.Address,
  tier: bcs.u8(),
  reasons: bcs.u16(),
  exposure_bps: bcs.u64(),
  req_approvals: bcs.u8(),
  req_guardians: bcs.u8(),
  executable_at: bcs.u64(),
  expires_at: bcs.u64(),
  reduction_mask: bcs.u32(),
  memo: bcs.string(),
  at: bcs.u64(),
});

const ApprovedBcs = bcs.struct('Approved', {
  vault: UID,
  proposal: bcs.u64(),
  approver: bcs.Address,
  approvals: bcs.u64(),
  req_approvals: bcs.u8(),
  at: bcs.u64(),
});

const RejectedBcs = bcs.struct('Rejected', {
  vault: UID,
  proposal: bcs.u64(),
  rejecter: bcs.Address,
  rejections: bcs.u64(),
  req_approvals: bcs.u8(),
  settled: bcs.bool(),
  at: bcs.u64(),
});

const ConfirmedBcs = bcs.struct('Confirmed', {
  vault: UID,
  proposal: bcs.u64(),
  guardian: bcs.Address,
  confirmations: bcs.u64(),
  req_guardians: bcs.u8(),
  at: bcs.u64(),
});

const SettledBcs = bcs.struct('Settled', {
  vault: UID,
  proposal: bcs.u64(),
  kind: bcs.u8(),
  status: bcs.u8(),
  actor: bcs.Address,
  at: bcs.u64(),
});

const ExecutedBcs = bcs.struct('Executed', {
  vault: UID,
  proposal: bcs.u64(),
  kind: bcs.u8(),
  asset: OptionTypeName,
  amount: bcs.u64(),
  recipient: bcs.Address,
  executor: bcs.Address,
  tier: bcs.u8(),
  balance_after: bcs.u64(),
  day_spent: bcs.u64(),
  at: bcs.u64(),
});

const BreakerTrippedBcs = bcs.struct('BreakerTripped', {
  vault: UID,
  proposal: bcs.u64(),
  asset: bcs.struct('TypeName', { name: bcs.string() }),
  amount: bcs.u64(),
  envelope_spent: bcs.u64(),
  envelope_limit: bcs.u64(),
  envelope_basis: bcs.u64(),
  at: bcs.u64(),
});

const ModeChangedBcs = bcs.struct('ModeChanged', {
  vault: UID,
  from: bcs.u8(),
  to: bcs.u8(),
  actor: bcs.Address,
  reasons: bcs.u16(),
  at: bcs.u64(),
});

const PolicyChangedBcs = bcs.struct('PolicyChanged', {
  vault: UID,
  proposal: bcs.u64(),
  version: bcs.u64(),
  reduction_mask: bcs.u32(),
  at: bcs.u64(),
});

const LimitsChangedBcs = bcs.struct('LimitsChanged', {
  vault: UID,
  proposal: bcs.u64(),
  asset: bcs.struct('TypeName', { name: bcs.string() }),
  approved: bcs.bool(),
  low_max: bcs.u64(),
  high_max: bcs.u64(),
  per_tx_max: bcs.u64(),
  daily_max: bcs.u64(),
  reduction_mask: bcs.u32(),
  at: bcs.u64(),
});

const MemberChangedBcs = bcs.struct('MemberChanged', {
  vault: UID,
  proposal: bcs.u64(),
  member: bcs.Address,
  roles_before: bcs.u8(),
  roles_after: bcs.u8(),
  at: bcs.u64(),
});

const RecipientRegisteredBcs = bcs.struct('RecipientRegistered', {
  vault: UID,
  recipient: bcs.Address,
  trust: bcs.u8(),
  activates_at: bcs.u64(),
  label: bcs.string(),
  actor: bcs.Address,
  at: bcs.u64(),
});

const RecipientTrustChangedBcs = bcs.struct('RecipientTrustChanged', {
  vault: UID,
  proposal: bcs.u64(),
  recipient: bcs.Address,
  from: bcs.u8(),
  to: bcs.u8(),
  actor: bcs.Address,
  at: bcs.u64(),
});

const RecoveredBcs = bcs.struct('Recovered', {
  vault: UID,
  proposal: bcs.u64(),
  lost: bcs.Address,
  replacement: bcs.Address,
  roles: bcs.u8(),
  at: bcs.u64(),
});

export type SkurEvent =
  | { name: 'VaultCreated'; vault: string; vaultName: string; creator: string; ownerCount: number; guardianCount: number; at: number }
  | { name: 'Deposited'; vault: string; asset: string; amount: bigint; balance: bigint; from: string; at: number }
  | {
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
    }
  | { name: 'Approved'; vault: string; proposal: bigint; approver: string; approvals: number; reqApprovals: number; at: number }
  | {
      name: 'Rejected';
      vault: string;
      proposal: bigint;
      rejecter: string;
      rejections: number;
      reqApprovals: number;
      settled: boolean;
      at: number;
    }
  | { name: 'Confirmed'; vault: string; proposal: bigint; guardian: string; confirmations: number; reqGuardians: number; at: number }
  | { name: 'Settled'; vault: string; proposal: bigint; kind: Kind; status: Status; actor: string; at: number }
  | {
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
    }
  | {
      name: 'BreakerTripped';
      vault: string;
      proposal: bigint;
      asset: string;
      amount: bigint;
      envelopeSpent: bigint;
      envelopeLimit: bigint;
      envelopeBasis: bigint;
      at: number;
    }
  | { name: 'ModeChanged'; vault: string; from: Mode; to: Mode; actor: string; reasons: number; at: number }
  | { name: 'PolicyChanged'; vault: string; proposal: bigint; version: bigint; reductionMask: number; at: number }
  | {
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
    }
  | { name: 'MemberChanged'; vault: string; proposal: bigint; member: string; rolesBefore: number; rolesAfter: number; at: number }
  | { name: 'RecipientRegistered'; vault: string; recipient: string; trust: Trust; activatesAt: number; label: string; actor: string; at: number }
  | { name: 'RecipientTrustChanged'; vault: string; proposal: bigint; recipient: string; from: Trust; to: Trust; actor: string; at: number }
  | { name: 'Recovered'; vault: string; proposal: bigint; lost: string; replacement: string; roles: number; at: number };

/** Ledger position, so an indexer can resume exactly where it stopped. */
export type EventPosition = {
  transactionDigest: string;
  eventIndex: number;
  checkpoint?: string;
  timestampMs?: number;
};

export type DecodedEvent = { event: SkurEvent; position: EventPosition };

const n = (v: string | number | bigint) => Number(v);
const b = (v: string | number | bigint) => BigInt(v);

/** Decode one Move event into a tagged union, or null if it is not one of ours. */
export function decodeEvent(eventType: string, bytes: Uint8Array): SkurEvent | null {
  const name = eventType.split('::').pop() as EventName | undefined;
  switch (name) {
    case 'VaultCreated': {
      const e = VaultCreatedBcs.parse(bytes);
      return { name, vault: e.vault, vaultName: e.name, creator: e.creator, ownerCount: n(e.owner_count), guardianCount: n(e.guardian_count), at: n(e.at) };
    }
    case 'Deposited': {
      const e = DepositedBcs.parse(bytes);
      return { name, vault: e.vault, asset: typeName(e.asset)!, amount: b(e.amount), balance: b(e.balance), from: e.from, at: n(e.at) };
    }
    case 'ProposalOpened': {
      const e = ProposalOpenedBcs.parse(bytes);
      return {
        name,
        vault: e.vault,
        proposal: b(e.proposal),
        kind: n(e.kind) as Kind,
        proposer: e.proposer,
        asset: typeName(e.asset),
        amount: b(e.amount),
        recipient: e.recipient,
        tier: n(e.tier) as Tier,
        reasons: n(e.reasons),
        exposureBps: n(e.exposure_bps),
        reqApprovals: n(e.req_approvals),
        reqGuardians: n(e.req_guardians),
        executableAt: n(e.executable_at),
        expiresAt: n(e.expires_at),
        reductionMask: n(e.reduction_mask),
        memo: e.memo,
        at: n(e.at),
      };
    }
    case 'Approved': {
      const e = ApprovedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), approver: e.approver, approvals: n(e.approvals), reqApprovals: n(e.req_approvals), at: n(e.at) };
    }
    case 'Rejected': {
      const e = RejectedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), rejecter: e.rejecter, rejections: n(e.rejections), reqApprovals: n(e.req_approvals), settled: e.settled, at: n(e.at) };
    }
    case 'Confirmed': {
      const e = ConfirmedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), guardian: e.guardian, confirmations: n(e.confirmations), reqGuardians: n(e.req_guardians), at: n(e.at) };
    }
    case 'Settled': {
      const e = SettledBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), kind: n(e.kind) as Kind, status: n(e.status) as Status, actor: e.actor, at: n(e.at) };
    }
    case 'Executed': {
      const e = ExecutedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), kind: n(e.kind) as Kind, asset: typeName(e.asset), amount: b(e.amount), recipient: e.recipient, executor: e.executor, tier: n(e.tier) as Tier, balanceAfter: b(e.balance_after), daySpent: b(e.day_spent), at: n(e.at) };
    }
    case 'BreakerTripped': {
      const e = BreakerTrippedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), asset: typeName(e.asset)!, amount: b(e.amount), envelopeSpent: b(e.envelope_spent), envelopeLimit: b(e.envelope_limit), envelopeBasis: b(e.envelope_basis), at: n(e.at) };
    }
    case 'ModeChanged': {
      const e = ModeChangedBcs.parse(bytes);
      return { name, vault: e.vault, from: n(e.from) as Mode, to: n(e.to) as Mode, actor: e.actor, reasons: n(e.reasons), at: n(e.at) };
    }
    case 'PolicyChanged': {
      const e = PolicyChangedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), version: b(e.version), reductionMask: n(e.reduction_mask), at: n(e.at) };
    }
    case 'LimitsChanged': {
      const e = LimitsChangedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), asset: typeName(e.asset)!, approved: e.approved, lowMax: b(e.low_max), highMax: b(e.high_max), perTxMax: b(e.per_tx_max), dailyMax: b(e.daily_max), reductionMask: n(e.reduction_mask), at: n(e.at) };
    }
    case 'MemberChanged': {
      const e = MemberChangedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), member: e.member, rolesBefore: n(e.roles_before), rolesAfter: n(e.roles_after), at: n(e.at) };
    }
    case 'RecipientRegistered': {
      const e = RecipientRegisteredBcs.parse(bytes);
      return { name, vault: e.vault, recipient: e.recipient, trust: n(e.trust) as Trust, activatesAt: n(e.activates_at), label: e.label, actor: e.actor, at: n(e.at) };
    }
    case 'RecipientTrustChanged': {
      const e = RecipientTrustChangedBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), recipient: e.recipient, from: n(e.from) as Trust, to: n(e.to) as Trust, actor: e.actor, at: n(e.at) };
    }
    case 'Recovered': {
      const e = RecoveredBcs.parse(bytes);
      return { name, vault: e.vault, proposal: b(e.proposal), lost: e.lost, replacement: e.replacement, roles: n(e.roles), at: n(e.at) };
    }
    default:
      return null;
  }
}

/**
 * Page through the package's events. The filter is `emitModule`, which is one predicate and so
 * works on every transport; events for other vaults are dropped client-side when `vaultId` is
 * given, because a module-wide filter is the finest the portable API offers.
 */
export async function listVaultEvents(
  client: ClientWithCoreApi,
  input: {
    packageId: string;
    vaultId?: string;
    limit?: number;
    /** Walk forwards from here. Use for indexing and for polling what is new. */
    after?: string | null;
    /** Walk backwards from here. Use for an interface showing newest first. */
    before?: string | null;
    order?: 'ascending' | 'descending';
  },
): Promise<{
  events: DecodedEvent[];
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
}> {
  const page = await client.core.listEvents({
    filter: { emitModule: `${input.packageId}::vault` },
    limit: input.limit ?? 50,
    ...(input.after != null ? { after: input.after } : {}),
    ...(input.before != null ? { before: input.before } : {}),
    ...(input.after == null && input.before == null
      ? { order: input.order ?? 'descending' }
      : {}),
  });
  const events: DecodedEvent[] = [];
  for (const e of page.events) {
    const decoded = decodeEvent(e.eventType, e.bcs);
    if (!decoded) continue;
    if (input.vaultId && decoded.vault !== input.vaultId) continue;
    events.push({
      event: decoded,
      position: {
        transactionDigest: e.transactionDigest,
        eventIndex: e.eventIndex,
        checkpoint: e.checkpoint ?? undefined,
        timestampMs: decoded.at,
      },
    });
  }
  return {
    events,
    startCursor: page.startCursor,
    endCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
  };
}

/** The Move type of one of our events, for a precise `eventType` filter. */
export function eventType(packageId: string, name: EventName): string {
  return moveType(packageId, 'vault', name);
}

export { PolicyBcs, AssetLimitsBcs };
