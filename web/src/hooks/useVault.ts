import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { erc20Abi, parseAbiItem, type PublicClient } from "viem";
import { SkurVaultAbi } from "../abi/SkurVault";
import { DEPLOYMENTS, NATIVE_ASSET } from "../config/chain";
import { policyFromContract } from "../lib/policy";
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
} from "../lib/types";

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

export type VaultData = {
  address: `0x${string}`;
  mode: Mode;
  policyVersion: number;
  policy: Policy;
  members: Member[];
  counts: { owners: number; approvers: number; executors: number; guardians: number };
  assets: AssetMeta[];
  velocity: Record<string, VelocityView>;
  proposals: ProposalView[];
  proposalCount: number;
  pendingCount: number;
  executedCount: number;
  recipients: RecipientView[];
  policyHistory: Array<{ version: number; activatedAt: bigint; txHash: `0x${string}` }>;
  modeHistory: Array<{ previous: Mode; mode: Mode; by: `0x${string}`; reason: string; txHash: `0x${string}`; block: bigint }>;
  fetchedAt: number;
};

const MAX_PROPOSALS = 200;

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 indexed id, uint8 indexed kind, address indexed proposer, address asset, address target, uint256 amount, uint8 tier, uint16 riskReasons, uint8 requiredApprovals, uint8 requiredGuardians, uint64 executableAfter, uint64 expiresAt, bool securityReducing, string memo)",
);
const recipientRegisteredEvent = parseAbiItem("event RecipientRegistered(address indexed recipient, uint64 activatesAt)");
const recipientTrustEvent = parseAbiItem("event RecipientTrustSet(address indexed recipient, uint8 previous, uint8 trust)");
const policyActivatedEvent = parseAbiItem(
  "event PolicyActivated(uint32 indexed version, uint64 activatedAt, (uint8 approvalsLow, uint8 approvalsHigh, uint8 approvalsCritical, uint8 governanceThreshold, uint8 guardianThreshold, bool guardianRequiredCritical, uint32 delayHigh, uint32 delayCritical, uint32 recipientActivationDelay, uint32 policyChangeDelay, uint32 recoveryDelay, uint32 proposalTtl, uint16 highExposureBps, uint16 criticalExposureBps, uint16 hardBlockExposureBps, uint16 envelopeBps, uint32 envelopeWindow) policy)",
);
const modeChangedEvent = parseAbiItem(
  "event ModeChanged(uint8 indexed previous, uint8 indexed mode, address indexed by, bytes32 reason)",
);

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

async function fetchVault(client: PublicClient, address: `0x${string}`): Promise<VaultData> {
  const vault = { address, abi: SkurVaultAbi } as const;
  const fromBlock = BigInt(DEPLOYMENTS.deployedAtBlock || 0);

  const [modeRaw, policyVersion, policyRaw, membersRaw, assetsRaw, proposalCountRaw, pendingCountRaw, executedCountRaw] =
    await Promise.all([
      client.readContract({ ...vault, functionName: "mode" }),
      client.readContract({ ...vault, functionName: "policyVersion" }),
      client.readContract({ ...vault, functionName: "getPolicy" }),
      client.readContract({ ...vault, functionName: "getMembers" }),
      client.readContract({ ...vault, functionName: "getAssets" }),
      client.readContract({ ...vault, functionName: "proposalCount" }),
      client.readContract({ ...vault, functionName: "pendingCount" }),
      client.readContract({ ...vault, functionName: "executedCount" }),
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

  const assets: AssetMeta[] = await Promise.all(
    assetsRaw.map(async (asset) => {
      const limitsRaw = (await client.readContract({ ...vault, functionName: "getAssetLimits", args: [asset] })) as AssetLimits;
      const limits: AssetLimits = {
        approved: limitsRaw.approved,
        lowMax: limitsRaw.lowMax,
        highMax: limitsRaw.highMax,
        perTxMax: limitsRaw.perTxMax,
        dailyMax: limitsRaw.dailyMax,
      };
      if (asset === NATIVE_ASSET) {
        const balance = await client.getBalance({ address });
        return { address: asset, symbol: "KASH", decimals: 18, limits, balance };
      }
      const [symbol, decimals, balance] = await Promise.all([
        client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => "TOKEN"),
        client.readContract({ address: asset, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
        client.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => 0n),
      ]);
      return { address: asset, symbol, decimals: Number(decimals), limits, balance };
    }),
  );

  const velocity: Record<string, VelocityView> = {};
  await Promise.all(
    assets.map(async (a) => {
      const v = await client.readContract({ ...vault, functionName: "velocityOf", args: [a.address] });
      velocity[a.address.toLowerCase()] = {
        daySpent: v[0],
        dailyMax: v[1],
        envelopeSpent: v[2],
        envelope: v[3],
        envelopeResetsAt: v[4],
      };
    }),
  );

  const [createdLogs, registeredLogs, trustLogs, policyLogs, modeLogs] = await Promise.all([
    client.getLogs({ address, event: proposalCreatedEvent, fromBlock, toBlock: "latest" }).catch(() => []),
    client.getLogs({ address, event: recipientRegisteredEvent, fromBlock, toBlock: "latest" }).catch(() => []),
    client.getLogs({ address, event: recipientTrustEvent, fromBlock, toBlock: "latest" }).catch(() => []),
    client.getLogs({ address, event: policyActivatedEvent, fromBlock, toBlock: "latest" }).catch(() => []),
    client.getLogs({ address, event: modeChangedEvent, fromBlock, toBlock: "latest" }).catch(() => []),
  ]);
  const memos = new Map<string, string>();
  for (const l of createdLogs) memos.set(String(l.args.id), l.args.memo ?? "");

  const proposalCount = Number(proposalCountRaw);
  const firstId = Math.max(1, proposalCount - MAX_PROPOSALS + 1);
  const ids: bigint[] = [];
  for (let i = proposalCount; i >= firstId; i--) ids.push(BigInt(i));
  const proposals: ProposalView[] = await Promise.all(
    ids.map(async (id) => {
      const [p, live, vetoable, approvers, guardianConfirmers] = await Promise.all([
        client.readContract({ ...vault, functionName: "getProposal", args: [id] }),
        client.readContract({ ...vault, functionName: "liveApprovals", args: [id] }),
        client.readContract({ ...vault, functionName: "isVetoable", args: [id] }),
        client.readContract({ ...vault, functionName: "getApprovers", args: [id] }),
        client.readContract({ ...vault, functionName: "getGuardianConfirmers", args: [id] }),
      ]);
      return {
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
      };
    }),
  );

  const recipientSet = new Set<string>();
  for (const l of registeredLogs) if (l.args.recipient) recipientSet.add(l.args.recipient);
  for (const l of trustLogs) if (l.args.recipient) recipientSet.add(l.args.recipient);
  for (const p of proposals) if (p.kind === Kind.TRANSFER) recipientSet.add(p.target);
  const recipients: RecipientView[] = await Promise.all(
    [...recipientSet].map(async (r) => {
      const rec = await client.readContract({ ...vault, functionName: "getRecipient", args: [r as `0x${string}`] });
      return {
        address: r as `0x${string}`,
        trust: Number(rec.trust) as Trust,
        registeredAt: rec.registeredAt,
        activatesAt: rec.activatesAt,
        paymentCount: rec.paymentCount,
        totalPaid: rec.totalPaid,
      };
    }),
  );
  recipients.sort((a, b) => Number(b.registeredAt - a.registeredAt));

  return {
    address,
    mode: Number(modeRaw) as Mode,
    policyVersion: Number(policyVersion),
    policy: policyFromContract(policyRaw as unknown as Record<string, unknown>),
    members,
    counts,
    assets,
    velocity,
    proposals,
    proposalCount,
    pendingCount: Number(pendingCountRaw),
    executedCount: Number(executedCountRaw),
    recipients,
    policyHistory: policyLogs.map((l) => ({
      version: Number(l.args.version),
      activatedAt: l.args.activatedAt ?? 0n,
      txHash: l.transactionHash,
    })),
    modeHistory: modeLogs.map((l) => ({
      previous: Number(l.args.previous) as Mode,
      mode: Number(l.args.mode) as Mode,
      by: l.args.by as `0x${string}`,
      reason: bytes32ToString(l.args.reason as `0x${string}`),
      txHash: l.transactionHash,
      block: l.blockNumber,
    })),
    fetchedAt: Date.now(),
  };
}

export function vaultQueryKey(address: `0x${string}` | null) {
  return ["vault", address] as const;
}

export function useVault(address: `0x${string}` | null) {
  const client = usePublicClient();
  return useQuery({
    queryKey: vaultQueryKey(address),
    queryFn: () => fetchVault(client as PublicClient, address as `0x${string}`),
    enabled: Boolean(address && client),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

export function useInvalidateVault(address: `0x${string}` | null) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: vaultQueryKey(address) });
}
