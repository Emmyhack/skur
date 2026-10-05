import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { describeFailure } from '@skur/sdk';
import { client } from '../lib/client';
import { NETWORK } from '../lib/config';
import { unlockSigner } from '../lib/keystore';

export type TxState =
  | { phase: 'idle' }
  | { phase: 'unlocking' }
  | { phase: 'signing' }
  | { phase: 'waiting'; digest: string }
  | { phase: 'done'; digest: string }
  | { phase: 'error'; message: string }
  | { phase: 'cancelled' };

/**
 * Sign and execute, with the key unlocked for exactly one action.
 *
 * The biometric prompt is per transaction, not per session. A cached signer is a signer that acts
 * without a face, which on a treasury app is the whole thing you were trying to avoid.
 */
export function useTx(vaultId: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ phase: 'idle' });

  const run = useCallback(
    async (build: () => Transaction, reason: string): Promise<string | null> => {
      try {
        setState({ phase: 'unlocking' });
        const keypair = await unlockSigner(reason);

        setState({ phase: 'signing' });
        const result = await client.signAndExecuteTransaction({
          transaction: build(),
          signer: keypair,
          include: { effects: true },
        });

        // A resolved promise means the network executed it, not that it succeeded: a Move abort
        // comes back as FailedTransaction.
        if (result.FailedTransaction) {
          const message = describeFailure(
            result.FailedTransaction.status.error?.message ?? 'the vault refused it',
          );
          setState({ phase: 'error', message });
          return null;
        }

        const digest = result.Transaction.digest;
        setState({ phase: 'waiting', digest });
        await client.core.waitForTransaction({ digest });

        await queryClient.invalidateQueries({ queryKey: ['vault', NETWORK, vaultId] });
        await queryClient.invalidateQueries({ queryKey: ['preview', NETWORK, vaultId] });
        setState({ phase: 'done', digest });
        return digest;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        // A declined fingerprint is not an error worth a red banner.
        if (raw === 'cancelled') {
          setState({ phase: 'cancelled' });
          return null;
        }
        setState({ phase: 'error', message: describeFailure(e) });
        return null;
      }
    },
    [queryClient, vaultId],
  );

  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  const busy = state.phase === 'unlocking' || state.phase === 'signing' || state.phase === 'waiting';

  return { run, state, reset, busy };
}
