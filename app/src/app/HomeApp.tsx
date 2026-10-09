'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import Link from 'next/link';
import { useState } from 'react';
import { MODE_LABELS, describeRoles } from '@skur/sdk';
import { API_URL, CONFIGURED, KNOWN_VAULTS, NETWORK } from '@/config';
import { useMyVaults, useVaultTx } from '@/hooks/useVault';
import { CreateVault } from '@/components/CreateVault';
import { PublishPackage } from '@/components/PublishPackage';
import { Shell } from '@/components/Shell';
import { Addr, Notice } from '@/components/ui';

export default function HomeApp() {
  const account = useCurrentAccount();
  const [mode, setMode] = useState<'open' | 'create'>('open');
  const [manual, setManual] = useState('');
  const tx = useVaultTx(undefined);
  const mine = useMyVaults(account?.address, API_URL);

  return (
    <Shell>
      <div style={{ maxWidth: 680, marginBottom: 24 }}>
        <h1>A valid signature is not a safe payment</h1>
        <p className="soft" style={{ marginTop: 10 }}>
          Policy-enforced treasuries on Sui. Open yours, or create one.
        </p>
      </div>

      <nav className="nav" style={{ marginBottom: 20 }}>
        <button data-active={mode === 'open'} onClick={() => setMode('open')}>
          Open a vault
        </button>
        <button data-active={mode === 'create'} onClick={() => setMode('create')}>
          Create one
        </button>
      </nav>

      {mode === 'create' ? (
        CONFIGURED ? <CreateVault tx={tx} /> : <PublishPackage />
      ) : (
        <div className="grid cols-2">
          <div className="card">
            <h3>Your vaults</h3>
            {!account ? (
              <p className="small soft" style={{ marginTop: 8 }}>
                Connect a wallet to see the vaults you hold a role in.
              </p>
            ) : !API_URL ? (
              <p className="small soft" style={{ marginTop: 8 }}>
                Finding your vaults by address needs the indexer. Set{' '}
                <code className="mono">NEXT_PUBLIC_SKUR_API</code>, or open a vault by its id.
              </p>
            ) : mine.isLoading ? (
              <div className="empty">Looking…</div>
            ) : mine.error ? (
              <p className="small soft" style={{ marginTop: 8 }}>
                The indexer is not reachable. You can still open a vault by its id.
              </p>
            ) : mine.data && mine.data.length > 0 ? (
              <div className="stack tight" style={{ marginTop: 14 }}>
                {mine.data.map((v) => (
                  <Link
                    key={v.vault_id}
                    href={`/vault/${v.vault_id}`}
                    className="card sunk"
                    style={{ padding: 13, textDecoration: 'none' }}
                  >
                    <div className="row wrap">
                      <strong className="small">{v.name}</strong>
                      <span className="grow" />
                      <span className="pill">{MODE_LABELS[v.mode as 0 | 1 | 2]}</span>
                    </div>
                    <p className="small faint" style={{ marginTop: 4 }}>
                      {describeRoles(v.roles).join(' · ') || 'no role'}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty">No vaults found for this address.</div>
            )}
          </div>

          <div className="stack">
            <div className="card">
              <h3>Open by id</h3>
              <p className="small soft">Anyone can read a vault; acting needs a role.</p>
              <div className="row" style={{ marginTop: 14 }}>
                <input
                  placeholder="0x…"
                  value={manual}
                  onChange={(e) => setManual(e.target.value.trim())}
                  spellCheck={false}
                />
                <Link
                  className="btn primary"
                  href={/^0x[0-9a-fA-F]{10,66}$/.test(manual) ? `/vault/${manual}` : '/'}
                  aria-disabled={!/^0x[0-9a-fA-F]{10,66}$/.test(manual)}
                  style={
                    /^0x[0-9a-fA-F]{10,66}$/.test(manual)
                      ? undefined
                      : { pointerEvents: 'none', opacity: 0.45 }
                  }
                >
                  Open
                </Link>
              </div>
            </div>

            {KNOWN_VAULTS.length > 0 ? (
              <div className="card">
                <h3>On {NETWORK}</h3>
                <div className="stack tight" style={{ marginTop: 12 }}>
                  {KNOWN_VAULTS.map((v) => (
                    <div className="row wrap" key={v.id}>
                      <Link href={`/vault/${v.id}`} className="small" style={{ fontWeight: 600 }}>
                        {v.name}
                      </Link>
                      <span className="grow" />
                      <Addr value={v.id} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!CONFIGURED ? <PublishPackage /> : null}
          </div>
        </div>
      )}
    </Shell>
  );
}
