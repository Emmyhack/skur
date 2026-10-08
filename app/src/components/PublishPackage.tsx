'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { useState } from 'react';
import { dAppKit } from '@/dapp-kit';
import { NETWORK } from '@/config';
import { Notice } from '@/components/ui';

/**
 * Publish the Move package from the browser, signed by the connected wallet.
 *
 * Publishing is an ordinary transaction: the compiled modules ride in the payload and the sender
 * pays the storage. The bytecode is produced by `sui move build --dump-bytecode-as-base64` and
 * served next to the app, so getting a network live needs nothing but a funded wallet — no CLI,
 * no faucet gymnastics on the machine that runs the web app. The UpgradeCap lands in the
 * publisher's wallet: whoever publishes holds the upgrade rights, explicitly.
 */
type Dump = { modules: string[]; dependencies: string[] };
type State =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'done'; digest: string; packageId: string | null }
  | { phase: 'error'; message: string };

export function PublishPackage() {
  const account = useCurrentAccount();
  const [state, setState] = useState<State>({ phase: 'idle' });

  const publish = async () => {
    if (!account) return;
    setState({ phase: 'busy' });
    try {
      const res = await fetch('/skur-bytecode.json');
      if (!res.ok) throw new Error('the compiled package is not being served next to this app');
      const dump = (await res.json()) as Dump;

      const tx = new Transaction();
      const cap = tx.publish({ modules: dump.modules, dependencies: dump.dependencies });
      tx.transferObjects([cap], account.address);

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if ('FailedTransaction' in result && result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status?.error?.message ?? 'the network refused the publish',
        );
      }
      const executed = (result as { Transaction: { digest: string; effects?: unknown } }).Transaction;

      // The package id, when the effects carry it; the chain is authoritative either way.
      let packageId: string | null = null;
      const effects = executed.effects as
        | { changedObjects?: { objectId?: string; id?: string; idOperation?: string; outputOwner?: unknown; objectType?: string }[] }
        | undefined;
      for (const c of effects?.changedObjects ?? []) {
        if (c.idOperation === 'Created' && (c.objectType === 'package' || c.outputOwner === undefined)) {
          packageId = c.objectId ?? c.id ?? null;
          break;
        }
      }
      setState({ phase: 'done', digest: executed.digest, packageId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({
        phase: 'error',
        message: /reject|denied|dismiss/i.test(message) ? 'The wallet declined it. Nothing was published.' : message,
      });
    }
  };

  if (state.phase === 'done') {
    return (
      <Notice kind="ok">
        Published to {NETWORK}. Digest <code className="mono">{state.digest}</code>
        {state.packageId ? (
          <>
            {' '}· package <code className="mono">{state.packageId}</code>
          </>
        ) : null}
        <p className="small soft" style={{ marginTop: 6 }}>
          Set <code className="mono">NEXT_PUBLIC_SKUR_PACKAGE_ID</code> to the package id and
          restart the app. The UpgradeCap is in your wallet.
        </p>
      </Notice>
    );
  }

  return (
    <div className="card">
      <h3>No package on {NETWORK} yet</h3>
      <p className="small soft" style={{ marginTop: 8 }}>
        The Skur Move package has not been published to this network. Your connected wallet can do
        it right here — publishing is a transaction like any other, and costs a fraction of a SUI
        in storage. The upgrade rights land in your wallet.
      </p>
      {!account ? (
        <p className="small faint" style={{ marginTop: 10 }}>Connect a wallet first.</p>
      ) : (
        <button
          className="btn primary"
          style={{ marginTop: 14 }}
          disabled={state.phase === 'busy'}
          onClick={() => void publish()}
        >
          {state.phase === 'busy' ? 'Waiting for the wallet…' : `Publish Skur to ${NETWORK}`}
        </button>
      )}
      {state.phase === 'error' ? (
        <div style={{ marginTop: 10 }}>
          <Notice kind="bad">{state.message}</Notice>
        </div>
      ) : null}
    </div>
  );
}
