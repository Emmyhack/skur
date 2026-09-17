import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { fetchActivity, fetchCore, type VaultActivity, type VaultData } from "../lib/vaultReads";

export type { Member, ProposalView, VelocityView, RecipientView, VaultCore, VaultActivity, VaultData } from "../lib/vaultReads";

export function vaultQueryKey(address: `0x${string}` | null) {
  return ["vault", address] as const;
}

const EMPTY_ACTIVITY: VaultActivity = { proposals: [], recipients: [], logsFailed: false, policyHistory: [], modeHistory: [] };

/**
 * Two queries so the interface paints as soon as balances and policy arrive, then fills in the
 * queue and history. Both refresh on an interval and are invalidated together after a write.
 */
export function useVault(address: `0x${string}` | null): { data: VaultData | undefined; error: unknown; isLoading: boolean } {
  const client = usePublicClient();
  const core = useQuery({
    queryKey: [...vaultQueryKey(address), "core"],
    queryFn: () => fetchCore(client as PublicClient, address as `0x${string}`),
    enabled: Boolean(address && client),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
  const activity = useQuery({
    queryKey: [...vaultQueryKey(address), "activity", core.data?.proposalCount ?? -1],
    queryFn: () => fetchActivity(client as PublicClient, address as `0x${string}`, core.data?.proposalCount ?? 0, core.data?.blockNumber ?? 0n),
    enabled: Boolean(address && client && core.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
  const data: VaultData | undefined = core.data
    ? { ...core.data, ...(activity.data ?? EMPTY_ACTIVITY), activityLoading: !activity.data, fetchedAt: core.dataUpdatedAt }
    : undefined;
  return { data, error: core.error ?? activity.error, isLoading: core.isLoading };
}

/**
 * Refresh after a write. The devnet RPC sits behind replicas that can lag a mined receipt by several
 * seconds, so one refetch straight after the receipt often reads the old state; a few bounded
 * follow-ups catch up without waiting for the regular interval.
 */
export function useInvalidateVault(address: `0x${string}` | null) {
  const qc = useQueryClient();
  return () => {
    const key = vaultQueryKey(address);
    void qc.invalidateQueries({ queryKey: key });
    for (const ms of [6_000, 15_000, 30_000]) setTimeout(() => void qc.invalidateQueries({ queryKey: key }), ms);
  };
}
