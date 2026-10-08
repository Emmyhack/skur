'use client';

import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import {
  describeFailure,
  fetchVaultView,
  previewTransfer,
  type TransferPreview,
  type VaultView,
} from '@skur/sdk';
import { NETWORK, PACKAGE_ID } from '@/config';

/** Everything one vault screen needs, in as few round trips as the transport allows. */
export function useVaultView(vaultId: string | undefined) {
  const client = useCurrentClient();
  return useQuery<VaultView>({
    queryKey: ['vault', NETWORK, vaultId],
    enabled: Boolean(vaultId),
    queryFn: () => fetchVaultView(client, vaultId!),
  });
}

/**
 * What the vault itself says this payment would need.
 *
 * This simulates the vault's own `preview_transfer` rather than running the TypeScript engine, so
 * the number on the confirmation screen is the number the chain will demand. The engine is used
 * only for a policy that is not deployed yet.
 */
export function useTransferPreview(input: {
  vaultId: string;
  coinType: string;
  amount: bigint;
  recipient: string;
  sender: string | undefined;
  enabled: boolean;
}) {
  const client = useCurrentClient();
  return useQuery<TransferPreview>({
    queryKey: [
      'preview',
      NETWORK,
      input.vaultId,
      input.coinType,
      input.amount.toString(),
      input.recipient,
    ],
    enabled: input.enabled && Boolean(input.sender) && input.amount > 0n,
    staleTime: 10_000,
    refetchInterval: false,
    queryFn: () =>
      previewTransfer(client, {
        packageId: PACKAGE_ID,
        vaultId: input.vaultId,
        coinType: input.coinType,
        amount: input.amount,
        recipient: input.recipient,
        sender: input.sender!,
      }),
  });
}

export type TxState = {
  run: (tx: Transaction, label: string) => Promise<string | null>;
  pending: string | null;
  error: string | null;
  lastDigest: string | null;
  clear: () => void;
};

/**
 * Sign, execute, wait, invalidate.
 *
 * A resolved promise means the network executed the transaction, which is not the same as the
 * transaction having succeeded — a Move abort comes back as `FailedTransaction`. The abort code is
 * translated into the sentence the contract means by it.
 */
export function useVaultTx(vaultId: string | undefined): TxState {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ tx }: { tx: Transaction; label: string }) => {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(
          describeFailure(result.FailedTransaction.status.error?.message ?? 'the vault refused it'),
        );
      }
      const digest = result.Transaction.digest;
      await client.core.waitForTransaction({ digest });
      return digest;
    },
  });

  const run = useCallback(
    async (tx: Transaction, label: string) => {
      setError(null);
      setPending(label);
      try {
        const digest = await mutation.mutateAsync({ tx, label });
        setLastDigest(digest);
        await queryClient.invalidateQueries({ queryKey: ['vault', NETWORK, vaultId] });
        await queryClient.invalidateQueries({ queryKey: ['preview', NETWORK, vaultId] });
        return digest;
      } catch (e) {
        setError(describeFailure(e));
        return null;
      } finally {
        setPending(null);
      }
    },
    [mutation, queryClient, vaultId],
  );

  return { run, pending, error, lastDigest, clear: () => setError(null) };
}

/** Vaults the connected address is a member of, via the indexer when one is configured. */
export function useMyVaults(address: string | undefined, apiUrl: string) {
  return useQuery<{ vault_id: string; name: string; roles: number; mode: number }[]>({
    queryKey: ['my-vaults', NETWORK, address],
    enabled: Boolean(address && apiUrl),
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/members/${address}/vaults`);
      if (!res.ok) throw new Error(`the indexer returned ${res.status}`);
      const body = (await res.json()) as { vaults: { vault_id: string; name: string; roles: number; mode: number }[] };
      return body.vaults;
    },
  });
}
