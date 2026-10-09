import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { dAppKit } from '@/dapp-kit';
import { NETWORK } from '@/config';

/**
 * One submission path for every web transaction: this app builds the bytes against its own
 * client (gas selection included), the wallet signs raw bytes — the one job only it can do —
 * and this app executes the signed bytes through the same client.
 *
 * The wallet's build/preview/execute machinery never runs. Every blank '{}' failure this app
 * has seen came from exactly that machinery, pointed at whatever network the extension happened
 * to be on.
 */
export type Executed = {
  digest: string;
  effects?: {
    status?: { success?: boolean; error?: { message?: string } };
    changedObjects?: {
      objectId?: string;
      id?: string;
      idOperation?: string;
      outputOwner?: { $kind?: string; ObjectOwner?: string; AddressOwner?: string };
    }[];
  };
};

export async function signAndExecute(
  client: ClientWithCoreApi,
  tx: Transaction,
  sender: string,
): Promise<Executed> {
  tx.setSenderIfNotSet(sender);
  const built = await tx.build({ client });
  const signed = await dAppKit.signTransaction({ transaction: toBase64(built), network: NETWORK });

  const result = await client.core.executeTransaction({
    transaction: fromBase64(signed.bytes),
    signatures: [signed.signature],
    include: { effects: true },
  });
  if (result.FailedTransaction) {
    throw new Error(
      (result.FailedTransaction as { status?: { error?: { message?: string } } }).status?.error?.message ??
        'the network refused it',
    );
  }
  const executed = result.Transaction as unknown as Executed;
  if (executed.effects?.status && executed.effects.status.success === false) {
    throw new Error(executed.effects.status.error?.message ?? 'the network refused it');
  }
  await client.core.waitForTransaction({ digest: executed.digest });
  return executed;
}
