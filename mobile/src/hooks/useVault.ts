import { useQuery } from '@tanstack/react-query';
import {
  fetchVaultView,
  previewTransfer,
  type TransferPreview,
  type VaultView,
} from '@skur/sdk';
import { client } from '../lib/client';
import { NETWORK, PACKAGE_ID } from '../lib/config';

/** Everything one screen needs, read from the chain. */
export function useVaultView(vaultId: string | null) {
  return useQuery<VaultView>({
    queryKey: ['vault', NETWORK, vaultId],
    enabled: Boolean(vaultId),
    // A vault is a shared object, so anyone's write changes it. Short freshness, and a poll
    // slow enough that the screen does not look like it is reloading constantly.
    staleTime: 5_000,
    refetchInterval: 20_000,
    retry: 1,
    queryFn: () => fetchVaultView(client, vaultId!),
  });
}

/**
 * What the vault itself will demand for this payment.
 *
 * Simulated against the chain's own `preview_transfer`, not computed here, so the confirmation
 * screen cannot promise something execution would refuse.
 */
export function useTransferPreview(input: {
  vaultId: string | null;
  coinType: string;
  amount: bigint;
  recipient: string;
  sender: string | null;
  enabled: boolean;
}) {
  return useQuery<TransferPreview>({
    queryKey: [
      'preview',
      NETWORK,
      input.vaultId,
      input.coinType,
      input.amount.toString(),
      input.recipient,
    ],
    enabled:
      input.enabled &&
      Boolean(input.vaultId && input.sender && input.coinType) &&
      input.amount > 0n,
    staleTime: 10_000,
    refetchInterval: false,
    retry: 0,
    queryFn: () =>
      previewTransfer(client, {
        packageId: PACKAGE_ID,
        vaultId: input.vaultId!,
        coinType: input.coinType,
        amount: input.amount,
        recipient: input.recipient,
        sender: input.sender!,
      }),
  });
}
