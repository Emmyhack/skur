import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publicClient } from "../lib/client";
import { fetchActivity, fetchCore, type VaultActivity, type VaultData } from "@web/lib/vaultReads";
import { useStore } from "../state/store";
import { ROLE_GUARDIAN } from "@web/lib/types";

const EMPTY: VaultActivity = { proposals: [], recipients: [], logsFailed: false, policyHistory: [], modeHistory: [] };
const key = (a: `0x${string}` | null) => ["vault", a] as const;

/**
 * Core paints first, activity fills in. Background refetches are deliberately invisible: only a pull
 * to refresh shows the spinner, and the returned object keeps its identity while the data is unchanged,
 * so a screen does not re-render (or flash its loader) every time the interval fires.
 */
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

  // The queue survives a proposal count change: the new query starts empty, and swapping the list for a
  // loader for a few seconds is what reads as "reloading".
  const lastActivity = useRef<VaultActivity | null>(null);
  if (activity.data) lastActivity.current = activity.data;
  const shownActivity = activity.data ?? lastActivity.current;

  const data: VaultData | undefined = useMemo(
    () => (core.data ? { ...core.data, ...(shownActivity ?? EMPTY), activityLoading: !shownActivity, fetchedAt: Date.now() } : undefined),
    // Identity changes only when the data itself does; React Query keeps the same reference otherwise.
    [core.data, shownActivity],
  );

  const [manual, setManual] = useState(false);
  useEffect(() => { if (manual && !core.isFetching && !activity.isFetching) setManual(false); }, [manual, core.isFetching, activity.isFetching]);
  const refetch = useCallback(() => { setManual(true); void core.refetch(); void activity.refetch(); }, [core, activity]);

  return { data, error: core.error ?? activity.error, isLoading: core.isLoading && !core.data, refetch, refreshing: manual };
}

export function useInvalidateVault(address: `0x${string}` | null) {
  const qc = useQueryClient();
  return useCallback(() => {
    const k = key(address);
    void qc.invalidateQueries({ queryKey: k });
    // The devnet's replicas can lag a mined receipt by seconds; these catch up without a visible spinner.
    for (const ms of [6_000, 15_000, 30_000]) setTimeout(() => void qc.invalidateQueries({ queryKey: k }), ms);
  }, [qc, address]);
}

/** Roles the device signer holds in the open vault. */
export function useMyRoles(vault: VaultData | undefined): number {
  const { signer } = useStore();
  if (!vault || !signer) return 0;
  return vault.members.find((m) => m.address.toLowerCase() === signer.address.toLowerCase())?.roles ?? 0;
}

export const isGuardianRole = (roles: number) => Boolean(roles & ROLE_GUARDIAN);
