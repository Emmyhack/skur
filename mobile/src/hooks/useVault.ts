import { useQuery, useQueryClient } from "@tanstack/react-query";
import { publicClient } from "../lib/client";
import { fetchActivity, fetchCore, type VaultActivity, type VaultData } from "@web/lib/vaultReads";
import { useStore } from "../state/store";
import { ROLE_GUARDIAN } from "@web/lib/types";

const EMPTY: VaultActivity = { proposals: [], recipients: [], logsFailed: false, policyHistory: [], modeHistory: [] };
const key = (a: `0x${string}` | null) => ["vault", a] as const;

/** Same two-query shape as the web app: core paints first, activity fills in. */
export function useVault(address: `0x${string}` | null) {
  const core = useQuery({ queryKey: [...key(address), "core"], queryFn: () => fetchCore(publicClient, address!), enabled: Boolean(address), refetchInterval: 20_000, staleTime: 10_000 });
  const activity = useQuery({
    queryKey: [...key(address), "activity", core.data?.proposalCount ?? -1],
    queryFn: () => fetchActivity(publicClient, address!, core.data?.proposalCount ?? 0, core.data?.blockNumber ?? 0n),
    enabled: Boolean(address && core.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
  const data: VaultData | undefined = core.data ? { ...core.data, ...(activity.data ?? EMPTY), activityLoading: !activity.data, fetchedAt: core.dataUpdatedAt } : undefined;
  return { data, error: core.error ?? activity.error, isLoading: core.isLoading, refetch: () => { void core.refetch(); void activity.refetch(); }, refreshing: core.isFetching };
}

export function useInvalidateVault(address: `0x${string}` | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: key(address) });
    for (const ms of [6_000, 15_000, 30_000]) setTimeout(() => void qc.invalidateQueries({ queryKey: key(address) }), ms);
  };
}

/** Roles the device signer holds in the open vault. */
export function useMyRoles(vault: VaultData | undefined): number {
  const { signer } = useStore();
  if (!vault || !signer) return 0;
  return vault.members.find((m) => m.address.toLowerCase() === signer.address.toLowerCase())?.roles ?? 0;
}

export const isGuardianRole = (roles: number) => Boolean(roles & ROLE_GUARDIAN);
