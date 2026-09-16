/** Pure contract reads shared by the web and mobile interfaces. No React, no wagmi: a viem PublicClient in, plain data out. */
import { erc20Abi, parseAbiItem, type PublicClient, type AbiEvent, type ReadContractReturnType } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { DEPLOYMENTS, NATIVE_ASSET } from "../config/chain";
import { policyFromContract } from "./policy";
import {
  Kind,
  Mode,
  Status,
  Trust,
  type AssetLimits,
  type AssetMeta,
  type Policy,
  type Proposal,
  type Recipient,
} from "./types";

export type Member = { address: `0x${string}`; roles: number };

export type ProposalView = Proposal & {
  id: bigint;
  liveApprovals: number;
  liveGuardians: number;
  vetoable: boolean;
  approvers: `0x${string}`[];
  guardianConfirmers: `0x${string}`[];
  memo: string;
};

export type VelocityView = {
  daySpent: bigint;
  dailyMax: bigint;
  envelopeSpent: bigint;
  envelope: bigint;
  envelopeResetsAt: bigint;
};

export type RecipientView = Recipient & { address: `0x${string}` };

/** Fast path: everything needed to render balances, policy, members and limits, read concurrently. */
export type VaultCore = {
  address: `0x${string}`;
  mode: Mode;
  policyVersion: number;
  policy: Policy;
  members: Member[];
  counts: { owners: number; approvers: number; executors: number; guardians: number };
  assets: AssetMeta[];
  velocity: Record<string, VelocityView>;
  proposalCount: number;
  /** Head block at the time of the core read; the activity scan uses it so it needs no extra round trip. */
  blockNumber: bigint;
  pendingCount: number;
  executedCount: number;
};

/** Slow path: proposals, recipients and event history. Depends on the log queries, which the devnet serves slowly. */
export type VaultActivity = {
  proposals: ProposalView[];
  recipients: RecipientView[];
  /** True when the event scan failed; proposals still come from contract state but memos and histories are missing. */
  logsFailed: boolean;
  policyHistory: Array<{ version: number; activatedAt: bigint; txHash: `0x${string}` }>;
  modeHistory: Array<{ previous: Mode; mode: Mode; by: `0x${string}`; reason: string; txHash: `0x${string}`; block: bigint }>;
};

export type VaultData = VaultCore & VaultActivity & { activityLoading: boolean; fetchedAt: number };

export const MAX_PROPOSALS = 60;

/** Proposals in a terminal status never change again, so their reads are kept for the session. */
type ContractProposal = ReadContractReturnType<typeof SkurVaultAbi, "getProposal">;
type ProposalRaw = { id: bigint; p: ContractProposal; live: readonly [number, number] | readonly [bigint, bigint]; vetoable: boolean; approvers: readonly `0x${string}`[]; guardianConfirmers: readonly `0x${string}`[] };
const terminalCache = new Map<string, ProposalRaw>();

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 indexed id, uint8 indexed kind, address indexed proposer, address asset, address target, uint256 amount, uint8 tier, uint16 riskReasons, uint8 requiredApprovals, uint8 requiredGuardians, uint64 executableAfter, uint64 expiresAt, bool securityReducing, string memo)",
);
const recipientRegisteredEvent = parseAbiItem("event RecipientRegistered(address indexed recipient, uint64 activatesAt)");
const recipientTrustEvent = parseAbiItem("event RecipientTrustSet(address indexed recipient, uint8 previous, uint8 trust)");
const policyActivatedEvent = parseAbiItem(
  "event PolicyActivated(uint32 indexed version, uint64 activatedAt, (uint8 approvalsLow, uint8 approvalsHigh, uint8 approvalsCritical, uint8 governanceThreshold, uint8 guardianThreshold, bool guardianRequiredCritical, uint32 delayHigh, uint32 delayCritical, uint32 recipientActivationDelay, uint32 policyChangeDelay, uint32 recoveryDelay, uint32 proposalTtl, uint16 highExposureBps, uint16 criticalExposureBps, uint16 hardBlockExposureBps, uint16 envelopeBps, uint32 envelopeWindow) policy)",
);
const modeChangedEvent = parseAbiItem("event ModeChanged(uint8 indexed previous, uint8 indexed mode, address indexed by, bytes32 reason)");

function bytes32ToString(hex: `0x${string}`): string {
  const bytes = hex.slice(2).match(/.{2}/g) ?? [];
  let out = "";
  for (const b of bytes) {
    const c = parseInt(b, 16);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

export async function fetchCore(client: PublicClient, address: `0x${string}`): Promise<VaultCore> {
  const vault = { address, abi: SkurVaultAbi } as const;
  const [modeRaw, policyVersion, policyRaw, membersRaw, assetsRaw, proposalCountRaw, pendingCountRaw, executedCountRaw, nativeBalance, blockNumber] =
    await Promise.all([
      client.readContract({ ...vault, functionName: "mode" }),
      client.readContract({ ...vault, functionName: "policyVersion" }),
      client.readContract({ ...vault, functionName: "getPolicy" }),
      client.readContract({ ...vault, functionName: "getMembers" }),
      client.readContract({ ...vault, functionName: "getAssets" }),
      client.readContract({ ...vault, functionName: "proposalCount" }),
      client.readContract({ ...vault, functionName: "pendingCount" }),
      client.readContract({ ...vault, functionName: "executedCount" }),
      client.getBalance({ address }),
      client.getBlockNumber(),
    ]);

  const members: Member[] = membersRaw[0].map((a, i) => ({ address: a, roles: Number(membersRaw[1][i]) }));
  const counts = members.reduce(
    (acc, m) => ({
      owners: acc.owners + (m.roles & 1 ? 1 : 0),
      approvers: acc.approvers + (m.roles & 2 ? 1 : 0),
      executors: acc.executors + (m.roles & 4 ? 1 : 0),
      guardians: acc.guardians + (m.roles & 8 ? 1 : 0),
    }),
    { owners: 0, approvers: 0, executors: 0, guardians: 0 },
  );

  // Second wave of concurrent reads: per-asset limits, velocity and ERC-20 metadata.
  const perAsset = await Promise.all(
    assetsRaw.map(async (asset) => {
      const [limitsRaw, v, symbol, decimals, balance] = await Promise.all([
        client.readContract({ ...vault, functionName: "getAssetLimits", args: [asset] }),
        client.readContract({ ...vault, functionName: "velocityOf", args: [asset] }),
        asset === NATIVE_ASSET ? Promise.resolve("KASH") : client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => "TOKEN"),
        asset === NATIVE_ASSET ? Promise.resolve(18) : client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
        asset === NATIVE_ASSET ? Promise.resolve(nativeBalance) : client.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => 0n),
      ]);
      const limits: AssetLimits = { approved: limitsRaw.approved, lowMax: limitsRaw.lowMax, highMax: limitsRaw.highMax, perTxMax: limitsRaw.perTxMax, dailyMax: limitsRaw.dailyMax };
      const meta: AssetMeta = { address: asset, symbol, decimals: Number(decimals), limits, balance };
      const velocity: VelocityView = { daySpent: v[0], dailyMax: v[1], envelopeSpent: v[2], envelope: v[3], envelopeResetsAt: v[4] };
      return { meta, velocity };
    }),
  );
  const velocity: Record<string, VelocityView> = {};
  for (const { meta, velocity: v } of perAsset) velocity[meta.address.toLowerCase()] = v;

  return {
    address,
    mode: Number(modeRaw) as Mode,
    policyVersion: Number(policyVersion),
    policy: policyFromContract(policyRaw as unknown as Record<string, unknown>),
    members,
    counts,
    assets: perAsset.map((x) => x.meta),
    velocity,
    proposalCount: Number(proposalCountRaw),
    blockNumber,
    pendingCount: Number(pendingCountRaw),
    executedCount: Number(executedCountRaw),
  };
}

/** The devnet RPC caps eth_getLogs at 10,000 blocks per call, so the scan runs in parallel windows. */
const LOG_WINDOW = 9_000n;
type RawLog = { eventName?: string; args?: unknown; transactionHash: `0x${string}`; blockNumber: bigint };
async function getLogsChunked(client: PublicClient, address: `0x${string}`, events: readonly AbiEvent[], fromBlock: bigint, head: bigint): Promise<{ logs: RawLog[]; failed: boolean }> {
  try {
    // `head` comes from the core read and may be a few blocks stale, so the last window runs to "latest"
    // rather than to `head`; that keeps an event mined between the two reads from being missed.
    const windows: Array<[bigint, bigint | "latest"]> = [];
    for (let a = fromBlock; a <= head; a += LOG_WINDOW + 1n) windows.push([a, a + LOG_WINDOW > head ? head : a + LOG_WINDOW]);
    if (windows.length === 0) windows.push([fromBlock, "latest"]);
    else windows[windows.length - 1][1] = "latest";
    const chunks = await Promise.all(windows.map(([from, to]) => client.getLogs({ address, events, fromBlock: from, toBlock: to }) as unknown as Promise<RawLog[]>));
    return { logs: chunks.flat(), failed: false };
  } catch {
    return { logs: [], failed: true };
  }
}

export async function fetchActivity(client: PublicClient, address: `0x${string}`, proposalCount: number, head: bigint): Promise<VaultActivity> {
  const vault = { address, abi: SkurVaultAbi } as const;
  const fromBlock = BigInt(DEPLOYMENTS.deployedAtBlock || 0);

  const firstId = Math.max(1, proposalCount - MAX_PROPOSALS + 1);
  const ids: bigint[] = [];
  for (let i = proposalCount; i >= firstId; i--) ids.push(BigInt(i));

  // One log query for every event we index; the devnet serves each getLogs call slowly, so five
  // separate queries were the long pole of the page load.
  const [{ logs: allLogs, failed: logsFailed }, proposalsRaw] = await Promise.all([
    getLogsChunked(client, address, [proposalCreatedEvent, recipientRegisteredEvent, recipientTrustEvent, policyActivatedEvent, modeChangedEvent], fromBlock, head),
    Promise.all(
      ids.map(async (id): Promise<ProposalRaw> => {
        const cached = terminalCache.get(`${address}:${id}`);
        if (cached) return cached;
        const p = await client.readContract({ ...vault, functionName: "getProposal", args: [id] });
        const pending = Number(p.status) === Status.PENDING;
        const [live, vetoable, approvers, guardianConfirmers] = await Promise.all([
          pending ? client.readContract({ ...vault, functionName: "liveApprovals", args: [id] }) : ([0, 0] as const),
          pending ? client.readContract({ ...vault, functionName: "isVetoable", args: [id] }) : false,
          client.readContract({ ...vault, functionName: "getApprovers", args: [id] }),
          client.readContract({ ...vault, functionName: "getGuardianConfirmers", args: [id] }),
        ]);
        // Terminal proposals keep the confirmations they had; the live recount only matters while pending.
        const raw: ProposalRaw = { id, p, live: pending ? live : ([approvers.length, guardianConfirmers.length] as const), vetoable, approvers, guardianConfirmers };
        if (!pending) terminalCache.set(`${address}:${id}`, raw);
        return raw;
      }),
    ),
  ]);
  // viem types the args of a multi-event query as a union; narrow per event name explicitly.
  type LogWith<A> = { args: A; transactionHash: `0x${string}`; blockNumber: bigint };
  const byName = <A,>(name: string): LogWith<A>[] => allLogs.filter((l) => l.eventName === name) as unknown as LogWith<A>[];
  const createdLogs = byName<{ id?: bigint; memo?: string }>("ProposalCreated");
  const registeredLogs = byName<{ recipient?: `0x${string}` }>("RecipientRegistered");
  const trustLogs = byName<{ recipient?: `0x${string}` }>("RecipientTrustSet");
  const policyLogs = byName<{ version?: number; activatedAt?: bigint }>("PolicyActivated");
  const modeLogs = byName<{ previous?: number; mode?: number; by?: `0x${string}`; reason?: `0x${string}` }>("ModeChanged");

  const memos = new Map<string, string>();
  for (const l of createdLogs) memos.set(String(l.args.id), l.args.memo ?? "");

  const proposals: ProposalView[] = proposalsRaw.map(({ id, p, live, vetoable, approvers, guardianConfirmers }) => ({
    id,
    kind: Number(p.kind) as Kind,
    status: Number(p.status) as Status,
    tier: Number(p.tier),
    requiredApprovals: Number(p.requiredApprovals),
    requiredGuardians: Number(p.requiredGuardians),
    securityReducing: p.securityReducing,
    riskReasons: Number(p.riskReasons),
    policyVersion: Number(p.policyVersion),
    proposer: p.proposer,
    asset: p.asset,
    target: p.target,
    amount: p.amount,
    createdAt: p.createdAt,
    executableAfter: p.executableAfter,
    expiresAt: p.expiresAt,
    data: p.data,
    liveApprovals: Number(live[0]),
    liveGuardians: Number(live[1]),
    vetoable,
    approvers: [...approvers],
    guardianConfirmers: [...guardianConfirmers],
    memo: memos.get(String(id)) ?? "",
  }));

  const recipientSet = new Set<string>();
  for (const l of registeredLogs) if (l.args.recipient) recipientSet.add(l.args.recipient);
  for (const l of trustLogs) if (l.args.recipient) recipientSet.add(l.args.recipient);
  for (const p of proposals) if (p.kind === Kind.TRANSFER) recipientSet.add(p.target);
  const recipients: RecipientView[] = await Promise.all(
    [...recipientSet].map(async (r) => {
      const rec = await client.readContract({ ...vault, functionName: "getRecipient", args: [r as `0x${string}`] });
      return { address: r as `0x${string}`, trust: Number(rec.trust) as Trust, registeredAt: rec.registeredAt, activatesAt: rec.activatesAt, paymentCount: rec.paymentCount, totalPaid: rec.totalPaid };
    }),
  );
  recipients.sort((a, b) => Number(b.registeredAt - a.registeredAt));

  return {
    proposals,
    recipients,
    logsFailed,
    policyHistory: policyLogs.map((l) => ({ version: Number(l.args.version), activatedAt: l.args.activatedAt ?? 0n, txHash: l.transactionHash })),
    modeHistory: modeLogs.map((l) => ({
      previous: Number(l.args.previous) as Mode,
      mode: Number(l.args.mode) as Mode,
      by: l.args.by as `0x${string}`,
      reason: bytes32ToString(l.args.reason as `0x${string}`),
      txHash: l.transactionHash,
      block: l.blockNumber,
    })),
  };
}

