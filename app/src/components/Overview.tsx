'use client';

import {
  Mode,
  Status,
  describeReasons,
  fmtAmount,
  fmtDuration,
  type VaultView,
} from '@skur/sdk';
import { EXPLORER } from '@/config';
import { Addr, ModePill, Notice, coinDecimals, coinSymbol } from './ui';

/**
 * What the vault is right now: its posture, what it holds, how much of each window is used, and
 * the policy in one glance. Everything here is read from the chain.
 */
export function Overview({ view }: { view: VaultView }) {
  const { vault, assets, proposals, members } = view;
  const pending = proposals.filter((p) => p.status === Status.PENDING);
  const p = vault.policy;

  return (
    <div className="stack">
      {vault.mode === Mode.LOCKDOWN ? (
        <Notice kind="bad">
          <strong>This vault is in Lockdown.</strong> Nothing outgoing executes and no payment can
          be opened. Deposits still work. Leaving Lockdown needs{' '}
          {p.governanceThreshold} owner approval{p.governanceThreshold === 1 ? '' : 's'},{' '}
          {p.guardianThreshold} guardian confirmation{p.guardianThreshold === 1 ? '' : 's'} and{' '}
          {fmtDuration(p.policyChangeDelay)}.
          {vault.postureReasons ? (
            <ul className="reasons">
              {describeReasons(vault.postureReasons).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {vault.mode === Mode.ELEVATED ? (
        <Notice kind="warn">
          <strong>Elevated.</strong> Every payment is escalated one tier and the per-transaction and
          daily caps are halved, until owners and a guardian agree to lower the posture.
          {vault.postureReasons ? (
            <ul className="reasons">
              {describeReasons(vault.postureReasons).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      <div className="grid cols-4">
        <div className="card">
          <p className="small soft">Posture</p>
          <div style={{ marginTop: 6 }}>
            <ModePill mode={vault.mode} />
          </div>
        </div>
        <div className="card">
          <p className="small soft">Awaiting action</p>
          <h2 style={{ marginTop: 4 }}>{pending.length}</h2>
        </div>
        <div className="card">
          <p className="small soft">Signers</p>
          <h2 style={{ marginTop: 4 }}>{members.length}</h2>
          <p className="small faint">
            {vault.ownerCount} owner{vault.ownerCount === 1 ? '' : 's'} · {vault.guardianCount}{' '}
            guardian{vault.guardianCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="card">
          <p className="small soft">Policy version</p>
          <h2 style={{ marginTop: 4 }}>{vault.policyVersion.toString()}</h2>
        </div>
      </div>

      <div className="card">
        <h3>Holdings</h3>
        <p className="small soft">
          Each asset has its own limits, its own day and its own loss envelope. There is no
          portfolio-wide number, because computing one honestly would need a price oracle.
        </p>
        {assets.length === 0 ? (
          <p className="soft small" style={{ marginTop: 12 }}>
            No assets configured yet.
          </p>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Balance</th>
                <th>Routine up to</th>
                <th>Per payment</th>
                <th>Today</th>
                <th>Envelope</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const d = coinDecimals(a.coinType);
                const sym = coinSymbol(a.coinType);
                const daily = a.limits.dailyMax;
                const spent = a.velocity?.daySpent ?? 0n;
                const dayPct = daily === 0n ? 0 : Number((spent * 100n) / daily);
                const basis = a.velocity?.envelopeBasis ?? a.balance;
                const envLimit =
                  p.envelopeBps === 0 ? 0n : (basis * BigInt(p.envelopeBps)) / 10_000n;
                const envSpent = a.velocity?.envelopeSpent ?? 0n;
                const envPct = envLimit === 0n ? 0 : Number((envSpent * 100n) / envLimit);
                return (
                  <tr key={a.coinType}>
                    <td>
                      <strong>{sym}</strong>
                      {!a.limits.approved ? (
                        <span className="pill critical" style={{ marginLeft: 6 }}>
                          not approved
                        </span>
                      ) : null}
                    </td>
                    <td>{fmtAmount(a.balance, d)}</td>
                    <td className="soft">{fmtAmount(a.limits.lowMax, d)}</td>
                    <td className="soft">
                      {a.limits.perTxMax === 0n ? 'no cap' : fmtAmount(a.limits.perTxMax, d)}
                    </td>
                    <td>
                      {daily === 0n ? (
                        <span className="soft">no cap</span>
                      ) : (
                        <>
                          <div className={`bar ${dayPct > 80 ? 'bad' : dayPct > 50 ? 'warn' : ''}`}>
                            <span style={{ width: `${Math.min(dayPct, 100)}%` }} />
                          </div>
                          <span className="small faint">
                            {fmtAmount(spent, d)} of {fmtAmount(daily, d)}
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {envLimit === 0n ? (
                        <span className="soft">off</span>
                      ) : (
                        <>
                          <div className={`bar ${envPct > 80 ? 'bad' : envPct > 50 ? 'warn' : ''}`}>
                            <span style={{ width: `${Math.min(envPct, 100)}%` }} />
                          </div>
                          <span className="small faint">
                            {fmtAmount(envSpent, d)} of {fmtAmount(envLimit, d)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Approvals</h3>
          <dl style={{ margin: '12px 0 0' }}>
            <div className="kv">
              <dt>Routine payment</dt>
              <dd>
                {p.approvalsLow} approval{p.approvalsLow === 1 ? '' : 's'}, no wait
              </dd>
            </div>
            <div className="kv">
              <dt>High risk</dt>
              <dd>
                {p.approvalsHigh} approvals, {fmtDuration(p.delayHigh)}
              </dd>
            </div>
            <div className="kv">
              <dt>Critical</dt>
              <dd>
                {p.approvalsCritical} approvals
                {p.guardianRequiredCritical ? ` + ${p.guardianThreshold} guardian` : ''},{' '}
                {fmtDuration(p.delayCritical)}
              </dd>
            </div>
            <div className="kv">
              <dt>Governance</dt>
              <dd>
                {p.governanceThreshold} owner{p.governanceThreshold === 1 ? '' : 's'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="card">
          <h3>Delays and limits</h3>
          <dl style={{ margin: '12px 0 0' }}>
            <div className="kv">
              <dt>New recipient waits</dt>
              <dd>{fmtDuration(p.recipientActivationDelay)}</dd>
            </div>
            <div className="kv">
              <dt>Weakening the policy waits</dt>
              <dd>{fmtDuration(p.policyChangeDelay)}</dd>
            </div>
            <div className="kv">
              <dt>Escalates above</dt>
              <dd>
                {p.highExposureBps / 100}% held, critical at {p.criticalExposureBps / 100}%
              </dd>
            </div>
            <div className="kv">
              <dt>Refused above</dt>
              <dd>
                {p.hardBlockExposureBps === 0
                  ? 'no hard block'
                  : `${p.hardBlockExposureBps / 100}% of an asset`}
              </dd>
            </div>
            <div className="kv">
              <dt>Loss envelope</dt>
              <dd>
                {p.envelopeBps === 0
                  ? 'off'
                  : `${p.envelopeBps / 100}% per ${fmtDuration(p.envelopeWindow)}`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card sunk">
        <div className="row wrap">
          <div className="grow">
            <p className="small soft">This vault</p>
            <Addr value={vault.id} />
          </div>
          <a className="btn sm" href={EXPLORER('object', vault.id)} target="_blank" rel="noreferrer">
            Open on the explorer
          </a>
        </div>
      </div>
    </div>
  );
}
