import type { ClientWithCoreApi } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import {
  AssetLimitsBcs,
  PolicyBcs,
  ProposalBcs,
  RecipientBcs,
  VaultBcs,
  VelocityBcs,
} from './bcs.js';
import { previewTransferTx } from './tx.js';
import {
  Kind,
  Mode,
  Status,
  Tier,
  Trust,
  type AssetLimits,
  type Policy,
  type Proposal,
  type RecipientRecord,
  type TransferPreview,
  type VaultSummary,
  type Velocity,
} from './types.js';

/**
 * Reading a vault.
 *
 * Written against `ClientWithCoreApi` rather than a concrete client, so the same code works over
 * gRPC and GraphQL. The vault's collections are Move `Table`s and a `Bag`, which are dynamic
 * fields on their own handles: list the names, then fetch the values.
 */

const CONCURRENCY = 16;

async function mapLimited<A, B>(items: A[], fn: (a: A) => Promise<B>, limit = CONCURRENCY) {
  const out: B[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function num(v: string | number | bigint): number {
  return Number(v);
}

function big(v: string | number | bigint): bigint {
  return BigInt(v);
}

function toPolicy(raw: ReturnType<typeof PolicyBcs.parse>): Policy {
  return {
    approvalsLow: raw.approvals_low,
    approvalsHigh: raw.approvals_high,
    approvalsCritical: raw.approvals_critical,
    governanceThreshold: raw.governance_threshold,
    guardianThreshold: raw.guardian_threshold,
    guardianRequiredCritical: raw.guardian_required_critical,
    delayHigh: num(raw.delay_high),
    delayCritical: num(raw.delay_critical),
    recipientActivationDelay: num(raw.recipient_activation_delay),
    policyChangeDelay: num(raw.policy_change_delay),
    recoveryDelay: num(raw.recovery_delay),
    proposalTtl: num(raw.proposal_ttl),
    highExposureBps: num(raw.high_exposure_bps),
    criticalExposureBps: num(raw.critical_exposure_bps),
    hardBlockExposureBps: num(raw.hard_block_exposure_bps),
    envelopeBps: num(raw.envelope_bps),
    envelopeWindow: num(raw.envelope_window),
  };
}

function toLimits(raw: ReturnType<typeof AssetLimitsBcs.parse>): AssetLimits {
  return {
    approved: raw.approved,
    lowMax: big(raw.low_max),
    highMax: big(raw.high_max),
    perTxMax: big(raw.per_tx_max),
    dailyMax: big(raw.daily_max),
  };
}

export async function fetchVault(
  client: ClientWithCoreApi,
  vaultId: string,
): Promise<VaultSummary> {
  const { object } = await client.core.getObject({ objectId: vaultId, include: { content: true } });
  const v = VaultBcs.parse(object.content);
  return {
    id: vaultId,
    name: v.name,
    policy: toPolicy(v.policy),
    policyVersion: big(v.policy_version),
    mode: num(v.mode) as Mode,
    postureReasons: num(v.posture_reasons),
    ownerCount: num(v.owner_count),
    approverCount: num(v.approver_count),
    executorCount: num(v.executor_count),
    guardianCount: num(v.guardian_count),
    nextProposal: big(v.next_proposal),
    pendingCount: num(v.pending_count),
    createdAt: num(v.created_at),
    tables: {
      members: v.members.id,
      limits: v.limits.id,
      funds: v.funds.id,
      velocity: v.velocity.id,
      recipients: v.recipients.id,
      proposals: v.proposals.id,
    },
    sizes: {
      members: num(v.members.size),
      limits: num(v.limits.size),
      funds: num(v.funds.size),
      velocity: num(v.velocity.size),
      recipients: num(v.recipients.size),
      proposals: num(v.proposals.size),
    },
  };
}

/** Every dynamic field name under a handle, paged to the end. */
async function listNames(client: ClientWithCoreApi, parentId: string) {
  const names: { type: string; bcs: Uint8Array }[] = [];
  let page = await client.core.listDynamicFields({ parentId, limit: 50 });
  for (;;) {
    for (const f of page.dynamicFields) names.push(f.name);
    if (!page.hasNextPage) break;
    page = await client.core.listDynamicFields({ parentId, cursor: page.cursor, limit: 50 });
  }
  return names;
}

async function readEntries<V>(
  client: ClientWithCoreApi,
  parentId: string,
  parse: (bytes: Uint8Array) => V,
) {
  const names = await listNames(client, parentId);
  return mapLimited(names, async (name) => {
    const { dynamicField } = await client.core.getDynamicField({ parentId, name });
    return { name, value: parse(dynamicField.value.bcs) };
  });
}

export async function fetchMembers(
  client: ClientWithCoreApi,
  vault: VaultSummary,
): Promise<{ address: string; roles: number }[]> {
  const entries = await readEntries(client, vault.tables.members, (b) => bcs.u8().parse(b));
  return entries.map((e) => ({
    address: bcs.Address.parse(e.name.bcs),
    roles: e.value,
  }));
}

/** The `TypeName` a `Table<TypeName, _>` or the funds `Bag` is keyed by. */
function parseTypeNameKey(bytes: Uint8Array): string {
  const name = bcs.struct('TypeName', { name: bcs.string() }).parse(bytes).name;
  // Move reports a type name without the leading `0x`; restore it so the string matches the
  // coin type an interface or an RPC filter would use.
  return name.startsWith('0x') ? name : `0x${name}`;
}

export async function fetchLimits(
  client: ClientWithCoreApi,
  vault: VaultSummary,
): Promise<{ coinType: string; limits: AssetLimits }[]> {
  const entries = await readEntries(client, vault.tables.limits, (b) =>
    toLimits(AssetLimitsBcs.parse(b)),
  );
  return entries.map((e) => ({ coinType: parseTypeNameKey(e.name.bcs), limits: e.value }));
}

export async function fetchBalances(
  client: ClientWithCoreApi,
  vault: VaultSummary,
): Promise<{ coinType: string; balance: bigint }[]> {
  const entries = await readEntries(client, vault.tables.funds, (b) => big(bcs.u64().parse(b)));
  return entries.map((e) => ({ coinType: parseTypeNameKey(e.name.bcs), balance: e.value }));
}

export async function fetchVelocity(
  client: ClientWithCoreApi,
  vault: VaultSummary,
): Promise<{ coinType: string; velocity: Velocity }[]> {
  const entries = await readEntries(client, vault.tables.velocity, (b) => {
    const raw = VelocityBcs.parse(b);
    return {
      dayAnchor: num(raw.day_anchor),
      daySpent: big(raw.day_spent),
      envelopeAnchor: num(raw.envelope_anchor),
      envelopeSpent: big(raw.envelope_spent),
      envelopeBasis: big(raw.envelope_basis),
    } satisfies Velocity;
  });
  return entries.map((e) => ({ coinType: parseTypeNameKey(e.name.bcs), velocity: e.value }));
}

export async function fetchRecipients(
  client: ClientWithCoreApi,
  vault: VaultSummary,
): Promise<RecipientRecord[]> {
  const entries = await readEntries(client, vault.tables.recipients, (b) => RecipientBcs.parse(b));
  return entries.map((e) => ({
    address: bcs.Address.parse(e.name.bcs),
    trust: num(e.value.trust) as Trust,
    registeredAt: num(e.value.registered_at),
    activatesAt: num(e.value.activates_at),
    paidCount: num(e.value.paid_count),
    lastPaid: num(e.value.last_paid),
    label: e.value.label,
  }));
}

function toProposal(raw: ReturnType<typeof ProposalBcs.parse>): Proposal {
  return {
    id: big(raw.id),
    kind: num(raw.kind) as Kind,
    status: num(raw.status) as Status,
    proposer: raw.proposer,
    createdAt: num(raw.created_at),
    executableAt: num(raw.executable_at),
    expiresAt: num(raw.expires_at),
    reqApprovals: raw.req_approvals,
    reqGuardians: raw.req_guardians,
    tier: num(raw.tier) as Tier,
    reasons: num(raw.reasons),
    exposureBps: num(raw.exposure_bps),
    policyVersion: big(raw.policy_version),
    reductionMask: num(raw.reduction_mask),
    approvals: raw.approvals.contents,
    confirmations: raw.confirmations.contents,
    asset: raw.asset ? (raw.asset.name.startsWith('0x') ? raw.asset.name : `0x${raw.asset.name}`) : null,
    amount: big(raw.amount),
    recipient: raw.recipient,
    memo: raw.memo,
    newPolicy: raw.new_policy ? toPolicy(raw.new_policy) : null,
    newLimits: raw.new_limits ? toLimits(raw.new_limits) : null,
    member: raw.member,
    memberPrev: raw.member_prev,
    memberRoles: raw.member_roles,
    trustLevel: num(raw.trust_level) as Trust,
    targetMode: num(raw.target_mode) as Mode,
  };
}

/** One proposal by its number. */
export async function fetchProposal(
  client: ClientWithCoreApi,
  vault: VaultSummary,
  id: bigint,
): Promise<Proposal | null> {
  try {
    const { dynamicField } = await client.core.getDynamicField({
      parentId: vault.tables.proposals,
      name: { type: 'u64', bcs: bcs.u64().serialize(id).toBytes() },
    });
    return toProposal(ProposalBcs.parse(dynamicField.value.bcs));
  } catch {
    return null;
  }
}

/**
 * The most recent proposals, newest first. Proposal numbers are sequential from 1, so this walks
 * backwards from the counter instead of listing the whole table — a vault with ten thousand
 * settled payments should not have to read all of them to show the queue.
 */
export async function fetchRecentProposals(
  client: ClientWithCoreApi,
  vault: VaultSummary,
  count = 25,
): Promise<Proposal[]> {
  const last = vault.nextProposal - 1n;
  const ids: bigint[] = [];
  for (let i = last; i > 0n && ids.length < count; i--) ids.push(i);
  const got = await mapLimited(ids, (id) => fetchProposal(client, vault, id));
  return got.filter((p): p is Proposal => p !== null);
}

/**
 * What the vault itself says a transfer would need, read by simulating its own
 * `preview_transfer`. The interface never computes this for a live vault: if the preview and the
 * execution could disagree, the preview is worthless.
 */
export async function previewTransfer(
  client: ClientWithCoreApi,
  input: {
    packageId: string;
    vaultId: string;
    coinType: string;
    amount: bigint;
    recipient: string;
    sender: string;
  },
): Promise<TransferPreview> {
  const tx = previewTransferTx(input.packageId, input);
  tx.setSender(input.sender);
  const result = await client.core.simulateTransaction({
    transaction: await tx.build({ client }),
    include: { commandResults: true },
  });
  const values = result.commandResults?.[0]?.returnValues;
  if (!values || values.length < 6) {
    throw new Error('preview_transfer returned no values; is the package id correct?');
  }
  const at = (i: number) => values[i].bcs ?? values[i];
  return {
    tier: num(bcs.u8().parse(at(0) as Uint8Array)) as Tier,
    reasons: num(bcs.u16().parse(at(1) as Uint8Array)),
    exposureBps: num(bcs.u64().parse(at(2) as Uint8Array)),
    reqApprovals: num(bcs.u8().parse(at(3) as Uint8Array)),
    reqGuardians: num(bcs.u8().parse(at(4) as Uint8Array)),
    delay: num(bcs.u64().parse(at(5) as Uint8Array)),
  };
}

/** Everything an interface needs for one screen, in as few round trips as the transport allows. */
export type VaultView = {
  vault: VaultSummary;
  members: { address: string; roles: number }[];
  assets: { coinType: string; limits: AssetLimits; balance: bigint; velocity: Velocity | null }[];
  recipients: RecipientRecord[];
  proposals: Proposal[];
};

export async function fetchVaultView(
  client: ClientWithCoreApi,
  vaultId: string,
  proposalCount = 25,
): Promise<VaultView> {
  const vault = await fetchVault(client, vaultId);
  const [members, limits, balances, velocity, recipients, proposals] = await Promise.all([
    fetchMembers(client, vault),
    fetchLimits(client, vault),
    fetchBalances(client, vault),
    fetchVelocity(client, vault),
    fetchRecipients(client, vault),
    fetchRecentProposals(client, vault, proposalCount),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.coinType, b.balance]));
  const velocityOf = new Map(velocity.map((v) => [v.coinType, v.velocity]));
  return {
    vault,
    members,
    recipients,
    proposals,
    assets: limits.map((l) => ({
      coinType: l.coinType,
      limits: l.limits,
      balance: balanceOf.get(l.coinType) ?? 0n,
      velocity: velocityOf.get(l.coinType) ?? null,
    })),
  };
}
