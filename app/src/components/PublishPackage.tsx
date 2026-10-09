'use client';

import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { useEffect, useState } from 'react';
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
  const client = useCurrentClient();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [balance, setBalance] = useState<bigint | null>(null);

  // Preflight: what this account actually holds on THIS network. Wallet extensions follow their
  // own network switch, and a mismatch (or an empty account) comes back as a blank error — so
  // the page states the number before the wallet is ever asked.
  useEffect(() => {
    let live = true;
    setBalance(null);
    if (!account) return;
    client.core
      .getBalance({ owner: account.address, coinType: '0x2::sui::SUI' })
      .then((r) => {
        if (live) setBalance(BigInt((r as { balance?: { balance?: string | bigint } }).balance?.balance ?? 0));
      })
      .catch(() => {
        if (live) setBalance(null);
      });
    return () => {
      live = false;
    };
  }, [account, client]);

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
      tx.setSender(account.address);

      // The division of labour that leaves the wallet nothing to get wrong: THIS page builds
      // the bytes against its own testnet client (gas selection included), the wallet only
      // signs them, and this page executes the signed bytes through the same client. The
      // wallet's build/preview/execute machinery — where every blank '{}' error so far was
      // born — is out of the loop entirely.
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
            'the network refused the publish',
        );
      }
      const executed = result.Transaction as unknown as {
        digest: string;
        effects?: {
          status?: { success?: boolean; error?: { message?: string } };
          changedObjects?: { objectId?: string; id?: string; idOperation?: string; outputOwner?: { $kind?: string } }[];
        };
      };
      if (executed.effects?.status && executed.effects.status.success === false) {
        throw new Error(executed.effects.status.error?.message ?? 'the network refused the publish');
      }
      await client.core.waitForTransaction({ digest: executed.digest });

      // A published package lands as an immutable created object; that id is the package id.
      let packageId: string | null = null;
      for (const c of executed.effects?.changedObjects ?? []) {
        if (c.idOperation === 'Created' && c.outputOwner?.$kind === 'Immutable') {
          packageId = c.objectId ?? c.id ?? null;
          break;
        }
      }
      setState({ phase: 'done', digest: executed.digest, packageId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const blank = !message || message === '{}' || /^\[object/.test(message);
      setState({
        phase: 'error',
        message: /reject|denied|dismiss/i.test(message)
          ? 'The wallet declined it. Nothing was published.'
          : blank
            ? `The wallet returned an empty error. The usual causes: the wallet's own network switch is not on ${NETWORK}, or this account holds no SUI on ${NETWORK}. Check both and try again.`
            : message,
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
      {account ? (
        <p className="small faint" style={{ marginTop: 10 }}>
          Signing as <code className="mono">{account.address.slice(0, 10)}…{account.address.slice(-4)}</code>
          {balance !== null ? (
            <>
              {' '}· holds <b>{(Number(balance) / 1e9).toFixed(2)} SUI</b> on {NETWORK}
              {balance < 400_000_000n ? ' — not enough to publish (~0.4 SUI needed); fund it or switch account' : ''}
            </>
          ) : null}
        </p>
      ) : null}
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
