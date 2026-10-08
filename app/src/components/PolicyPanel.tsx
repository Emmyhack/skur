'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useMemo, useState } from 'react';
import {
  POLICY_GROUPS,
  Role,
  fmtDuration,
  fromHours,
  hasRole,
  policyReductions,
  runScenarios,
  toHours,
  tx as build,
  validateCounts,
  validatePolicy,
  type Policy,
  type VaultView,
} from '@skur/sdk';
import { PACKAGE_ID } from '@/config';
import type { TxState } from '@/hooks/useVault';
import { Notice, coinDecimals, coinSymbol } from './ui';

/**
 * The policy editor and the simulator.
 *
 * Editing is one screen with the consequences on it: what the change gives up, whether it is
 * coherent at all, and what the attacks look like against the edited policy rather than the live
 * one. Everything here runs the same algorithms as the Move modules, which is the only reason it
 * is safe to show a number for a policy that is not deployed.
 */
export function PolicyPanel({ view, tx }: { view: VaultView; tx: TxState }) {
  const account = useCurrentAccount();
  const roles = account ? (view.members.find((m) => m.address === account.address)?.roles ?? 0) : 0;
  const [draft, setDraft] = useState<Policy>(view.vault.policy);

  const errors = useMemo(() => validatePolicy(draft), [draft]);
  const countErrors = useMemo(
    () =>
      validateCounts(
        draft,
        view.vault.ownerCount,
        view.vault.approverCount,
        view.vault.executorCount,
        view.vault.guardianCount,
      ),
    [draft, view.vault],
  );
  const reductions = useMemo(() => policyReductions(view.vault.policy, draft), [view.vault.policy, draft]);
  const changed = JSON.stringify(draft) !== JSON.stringify(view.vault.policy);
  const valid = errors.length === 0 && countErrors.length === 0;

  const set = (key: keyof Policy, value: number | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }) as Policy);

  const biggest = view.assets.reduce(
    (best, a) => (a.balance > (best?.balance ?? -1n) ? a : best),
    view.assets[0],
  );

  const scenarios = useMemo(() => {
    if (!biggest) return [];
    return runScenarios({
      policy: draft,
      limits: biggest.limits,
      balance: biggest.balance,
      decimals: coinDecimals(biggest.coinType),
      symbol: coinSymbol(biggest.coinType),
      approverCount: view.vault.approverCount,
      guardianCount: view.vault.guardianCount,
    });
  }, [draft, biggest, view.vault]);

  return (
    <div className="stack">
      {tx.error ? <Notice kind="bad">{tx.error}</Notice> : null}

      <div className="grid cols-2">
        <div className="stack">
          {POLICY_GROUPS.map((group) => (
            <div className="card" key={group.title}>
              <h3>{group.title}</h3>
              <p className="small soft">{group.sub}</p>
              <div style={{ marginTop: 14 }}>
                {group.fields.map((f) => {
                  const raw = draft[f.key];
                  if (f.unit === 'bool') {
                    return (
                      <div className="field row" key={f.key}>
                        <input
                          id={f.key}
                          type="checkbox"
                          style={{ width: 18, height: 18, flex: '0 0 auto' }}
                          checked={Boolean(raw)}
                          onChange={(e) => set(f.key, e.target.checked)}
                        />
                        <label htmlFor={f.key} style={{ margin: 0 }}>
                          {f.label}
                          <span className="faint"> — {f.hint}</span>
                        </label>
                      </div>
                    );
                  }
                  const value =
                    f.unit === 'hours'
                      ? toHours(Number(raw))
                      : f.unit === 'bps'
                        ? Number(raw) / 100
                        : Number(raw);
                  return (
                    <div className="field" key={f.key}>
                      <label htmlFor={f.key}>
                        {f.label}
                        {f.unit === 'hours' ? ' (hours)' : f.unit === 'bps' ? ' (%)' : ''}
                        {f.hint ? <span className="faint"> — {f.hint}</span> : null}
                      </label>
                      <input
                        id={f.key}
                        type="number"
                        min={0}
                        max={f.max}
                        step={f.unit === 'bps' ? 0.25 : 1}
                        value={value}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isNaN(n) || n < 0) return;
                          set(
                            f.key,
                            f.unit === 'hours'
                              ? fromHours(n)
                              : f.unit === 'bps'
                                ? Math.round(n * 100)
                                : Math.round(n),
                          );
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card">
            <h3>What this change does</h3>
            {!changed ? (
              <p className="small soft" style={{ marginTop: 8 }}>
                Nothing yet. Edit a field to see what it gives up.
              </p>
            ) : (
              <div style={{ marginTop: 10 }}>
                {errors.length > 0 || countErrors.length > 0 ? (
                  <Notice kind="bad">
                    <strong>The vault would not accept this policy.</strong>
                    <ul className="reasons">
                      {[...errors, ...countErrors].map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </Notice>
                ) : reductions.length === 0 ? (
                  <Notice kind="ok">
                    This change only tightens the vault, so it takes effect as soon as{' '}
                    {view.vault.policy.governanceThreshold} owner
                    {view.vault.policy.governanceThreshold === 1 ? '' : 's'} approve it.
                  </Notice>
                ) : (
                  <Notice kind="warn">
                    <strong>This gives up {reductions.length} control{reductions.length === 1 ? '' : 's'}.</strong>
                    <ul className="reasons">
                      {reductions.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <p className="small" style={{ marginTop: 8 }}>
                      It will wait {fmtDuration(view.vault.policy.policyChangeDelay)} and any
                      guardian can veto it. It cannot be opened at all while the vault is in
                      Lockdown.
                    </p>
                  </Notice>
                )}
              </div>
            )}

            <div className="row" style={{ marginTop: 16 }}>
              <button
                className="btn primary"
                disabled={!changed || !valid || !hasRole(roles, Role.OWNER) || Boolean(tx.pending)}
                onClick={() =>
                  tx.run(
                    build.proposePolicy(PACKAGE_ID, { vaultId: view.vault.id, policy: draft }),
                    'propose-policy',
                  )
                }
                title={!hasRole(roles, Role.OWNER) ? 'Changing the policy takes the owner role' : undefined}
              >
                {tx.pending === 'propose-policy' ? 'Opening…' : 'Propose this policy'}
              </button>
              <button
                className="btn ghost"
                disabled={!changed}
                onClick={() => setDraft(view.vault.policy)}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="card">
            <h3>The attacks, against this policy</h3>
            <p className="small soft">
              Run with the edited policy and this vault&apos;s largest holding. The verdicts are the
              vault&apos;s own rules, not a score.
            </p>
            {scenarios.length === 0 ? (
              <div className="empty">Fund an asset to run the scenarios.</div>
            ) : (
              <div className="stack tight" style={{ marginTop: 14 }}>
                {scenarios.map((s) => (
                  <div key={s.id} className="card sunk" style={{ padding: 13 }}>
                    <div className="row wrap">
                      <strong className="small">{s.title}</strong>
                      <span className="grow" />
                      <Verdict verdict={s.verdict} />
                    </div>
                    <p className="small soft" style={{ marginTop: 5 }}>
                      {s.narrative}
                    </p>
                    <ul className="reasons">
                      {s.detail.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Verdict({ verdict }: { verdict: string }) {
  const cls =
    verdict === 'blocked' || verdict === 'impossible'
      ? 'low'
      : verdict === 'delayed' || verdict === 'escalated'
        ? 'high'
        : 'critical';
  const label =
    verdict === 'blocked'
      ? 'stopped'
      : verdict === 'impossible'
        ? 'impossible'
        : verdict === 'delayed'
          ? 'delayed'
          : verdict === 'escalated'
            ? 'escalated'
            : 'would succeed';
  return <span className={`pill ${cls}`}>{label}</span>;
}
