'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useMemo, useState } from 'react';
import {
  Mode,
  Role,
  Trust,
  computeMaxLoss,
  fmtAmount,
  fmtDuration,
  hasRole,
  postureItems,
  tx as build,
  type VaultView,
} from '@skur/sdk';
import { PACKAGE_ID } from '@/config';
import type { TxState } from '@/hooks/useVault';
import { Notice, coinDecimals, coinSymbol } from './ui';

/**
 * The security screen: what holds, what the worst case looks like, and the two controls a human
 * reaches for in an incident.
 */
export function Security({ view, tx }: { view: VaultView; tx: TxState }) {
  const account = useCurrentAccount();
  const roles = account ? (view.members.find((m) => m.address === account.address)?.roles ?? 0) : 0;
  const posture = useMemo(
    () =>
      postureItems({
        policy: view.vault.policy,
        guardians: view.vault.guardianCount,
        assets: view.assets.map((a) => ({ symbol: coinSymbol(a.coinType), limits: a.limits })),
      }),
    [view],
  );

  const canFreeze = hasRole(roles, Role.GUARDIAN) || hasRole(roles, Role.OWNER);
  const [blockAddr, setBlockAddr] = useState('');

  return (
    <div className="stack">
      {tx.error ? <Notice kind="bad">{tx.error}</Notice> : null}

      <div className="grid cols-2">
        <div className="card">
          <h3>What holds</h3>
          <p className="small soft">
            Confirmed controls and obvious gaps. This is not a score and does not claim to measure
            absolute security.
          </p>
          <div className="stack tight" style={{ marginTop: 14 }}>
            {posture.map((item) => (
              <div className="row" key={item.text}>
                <span className={`dot ${item.ok}`} />
                <span className="small">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>In an incident</h3>
          <p className="small soft">
            Raising the posture is immediate and unilateral. Lowering it never is.
          </p>
          <div className="stack" style={{ marginTop: 16 }}>
            <button
              className="btn"
              disabled={!canFreeze || view.vault.mode >= Mode.ELEVATED || Boolean(tx.pending)}
              onClick={() =>
                tx.run(
                  build.raiseMode(PACKAGE_ID, { vaultId: view.vault.id, mode: Mode.ELEVATED }),
                  'elevate',
                )
              }
            >
              Raise to Elevated
            </button>
            <p className="small faint" style={{ marginTop: -6 }}>
              Escalates every payment one tier and halves the per-payment and daily caps.
            </p>

            <button
              className="btn danger"
              disabled={!canFreeze || view.vault.mode === Mode.LOCKDOWN || Boolean(tx.pending)}
              onClick={() =>
                tx.run(
                  build.raiseMode(PACKAGE_ID, { vaultId: view.vault.id, mode: Mode.LOCKDOWN }),
                  'lockdown',
                )
              }
            >
              Freeze the vault
            </button>
            <p className="small faint" style={{ marginTop: -6 }}>
              Stops all outgoing execution at once. Deposits keep working. Leaving needs{' '}
              {view.vault.policy.governanceThreshold} owner
              {view.vault.policy.governanceThreshold === 1 ? '' : 's'},{' '}
              {view.vault.policy.guardianThreshold} guardian
              {view.vault.policy.guardianThreshold === 1 ? '' : 's'} and{' '}
              {fmtDuration(view.vault.policy.policyChangeDelay)}.
            </p>

            {view.vault.mode !== Mode.NORMAL ? (
              <button
                className="btn"
                disabled={!hasRole(roles, Role.OWNER) || Boolean(tx.pending)}
                onClick={() =>
                  tx.run(
                    build.proposeModeRelax(PACKAGE_ID, {
                      vaultId: view.vault.id,
                      mode: view.vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL,
                    }),
                    'relax',
                  )
                }
              >
                Propose lowering the posture
              </button>
            ) : null}

            <div className="field" style={{ marginTop: 6 }}>
              <label htmlFor="block">Block a recipient immediately (guardian only)</label>
              <div className="row">
                <input
                  id="block"
                  placeholder="0x…"
                  value={blockAddr}
                  onChange={(e) => setBlockAddr(e.target.value.trim())}
                  spellCheck={false}
                />
                <button
                  className="btn danger"
                  disabled={
                    !hasRole(roles, Role.GUARDIAN) ||
                    !/^0x[0-9a-fA-F]{1,64}$/.test(blockAddr) ||
                    Boolean(tx.pending)
                  }
                  onClick={() =>
                    tx
                      .run(
                        build.guardianRestrict(PACKAGE_ID, {
                          vaultId: view.vault.id,
                          recipient: blockAddr,
                          trust: Trust.BLOCKED,
                        }),
                        'block',
                      )
                      .then((d) => {
                        if (d) setBlockAddr('');
                      })
                  }
                >
                  Block
                </button>
              </div>
              <p className="small faint" style={{ marginTop: 5 }}>
                The one unilateral power in the system, and it can only ever stop money.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Maximum possible loss</h3>
        <p className="small soft">
          Per asset, assuming every signer a tier needs is compromised and cooperating, and that no
          guardian acts. It is an upper bound under those assumptions, never a guarantee.
        </p>
        {view.assets.length === 0 ? (
          <div className="empty">No assets configured.</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Asset</th>
                <th>With no delay</th>
                <th>Bounded by</th>
                <th>Within a day</th>
                <th>Bounded by</th>
                <th>Largest payments wait</th>
              </tr>
            </thead>
            <tbody>
              {view.assets.map((a) => {
                const r = computeMaxLoss(view.vault.policy, a.limits, a.balance, view.vault.mode);
                const d = coinDecimals(a.coinType);
                return (
                  <tr key={a.coinType}>
                    <td>
                      <strong>{coinSymbol(a.coinType)}</strong>
                    </td>
                    <td>{fmtAmount(r.immediate, d)}</td>
                    <td className="small soft">{r.immediateBinding}</td>
                    <td>{fmtAmount(r.day, d)}</td>
                    <td className="small soft">{r.dayBinding}</td>
                    <td className="small">{fmtDuration(r.criticalDelay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <details style={{ marginTop: 14 }}>
          <summary className="small soft" style={{ cursor: 'pointer' }}>
            The assumptions behind these numbers
          </summary>
          <ul className="reasons">
            {computeMaxLoss(
              view.vault.policy,
              view.assets[0]?.limits ?? { approved: false, lowMax: 0n, highMax: 0n, perTxMax: 0n, dailyMax: 0n },
              view.assets[0]?.balance ?? 0n,
              view.vault.mode,
            ).assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
            <li>
              A 24-hour bucket anchors on its first payment, so up to two days&apos; allowance can
              leave across a boundary. The envelope and the per-payment cap bound that.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
