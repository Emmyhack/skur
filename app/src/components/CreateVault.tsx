'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useMemo, useState } from 'react';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import {
  Role,
  TEMPLATES,
  fmtDuration,
  rolesValid,
  templateById,
  tx as build,
  validateCounts,
  validatePolicy,
  type TemplateId,
} from '@skur/sdk';
import { CONFIGURED, PACKAGE_ID } from '@/config';
import type { TxState } from '@/hooks/useVault';
import { Notice } from './ui';

type Seat = { address: string; roles: number };

/**
 * Creating a vault.
 *
 * One transaction: the whole configuration goes into a single programmable transaction block, so
 * there is never a moment when a vault exists without its policy, its signers and its assets. If
 * any part is wrong the whole thing fails and nothing is created.
 *
 * The thresholds are checked against the roster before the wallet opens, because a vault whose
 * threshold nobody can reach is a frozen vault and the contract refuses to create one.
 */
export function CreateVault({ tx }: { tx: TxState }) {
  const account = useCurrentAccount();
  const me = account?.address;
  const [templateId, setTemplateId] = useState<TemplateId>('startup');
  const [name, setName] = useState('Treasury');
  const [seats, setSeats] = useState<Seat[]>([]);

  const template = templateById(templateId);
  const roster: Seat[] = useMemo(
    () => [
      ...(me ? [{ address: me, roles: Role.OWNER | Role.APPROVER | Role.EXECUTOR }] : []),
      ...seats.filter((s) => /^0x[0-9a-fA-F]{1,64}$/.test(s.address)),
    ],
    [me, seats],
  );

  const counts = useMemo(() => {
    const has = (r: number) => roster.filter((s) => (s.roles & r) !== 0).length;
    return {
      owners: has(Role.OWNER),
      approvers: has(Role.APPROVER),
      executors: has(Role.EXECUTOR),
      guardians: has(Role.GUARDIAN),
    };
  }, [roster]);

  const policyErrors = validatePolicy(template.policy);
  const countErrors = validateCounts(
    template.policy,
    counts.owners,
    counts.approvers,
    counts.executors,
    counts.guardians,
  );
  const badRoles = roster.filter((s) => !rolesValid(s.roles));
  const duplicates = roster.length !== new Set(roster.map((s) => s.address)).size;

  const ready =
    Boolean(me) &&
    CONFIGURED &&
    name.trim().length > 0 &&
    policyErrors.length === 0 &&
    countErrors.length === 0 &&
    badRoles.length === 0 &&
    !duplicates;

  const create = () =>
    tx.run(
      build.createVault(PACKAGE_ID, {
        name: name.trim(),
        policy: template.policy,
        members: roster,
        assets: [{ coinType: SUI_TYPE_ARG, limits: template.native }],
        recipients: [],
      }),
      'create',
    );

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>Pick a starting policy</h3>
        <p className="small soft">Complete policies. Tighten later through governance.</p>
        <div className="stack tight" style={{ marginTop: 14 }}>
          {TEMPLATES.map((t) => (
            <label
              key={t.id}
              className="card sunk"
              style={{
                padding: 13,
                cursor: 'pointer',
                borderColor: t.id === templateId ? 'var(--accent)' : undefined,
              }}
            >
              <div className="row">
                <input
                  type="radio"
                  name="template"
                  style={{ width: 16, height: 16, flex: '0 0 auto' }}
                  checked={t.id === templateId}
                  onChange={() => setTemplateId(t.id)}
                />
                <strong className="small">{t.name}</strong>
                <span className="grow" />
                <span className="pill">
                  {t.minSigners} signer{t.minSigners === 1 ? '' : 's'} · {t.minGuardians} guardian
                  {t.minGuardians === 1 ? '' : 's'}
                </span>
              </div>
              <p className="small soft" style={{ marginTop: 5 }}>
                {t.tagline}
              </p>
              <p className="small faint" style={{ marginTop: 4 }}>
                Critical waits {fmtDuration(t.policy.delayCritical)} · new recipients{' '}
                {fmtDuration(t.policy.recipientActivationDelay)} · envelope {t.policy.envelopeBps / 100}%/
                {fmtDuration(t.policy.envelopeWindow)}
              </p>
            </label>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <h3>Name it</h3>
          <div className="field">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
        </div>

        <div className="card">
          <h3>Who holds what</h3>
          <p className="small soft">You hold all roles to start. A guardian can hold nothing else.</p>

          {me ? (
            <div className="card sunk" style={{ marginTop: 14, padding: 12 }}>
              <div className="row wrap">
                <span className="mono small">{me.slice(0, 10)}…{me.slice(-6)}</span>
                <span className="pill">you</span>
                <span className="grow" />
                <span className="pill">Owner</span>
                <span className="pill">Approver</span>
                <span className="pill">Executor</span>
              </div>
            </div>
          ) : null}

          <div className="stack tight" style={{ marginTop: 12 }}>
            {seats.map((s, i) => (
              <div className="row wrap" key={i}>
                <input
                  placeholder="0x…"
                  value={s.address}
                  onChange={(e) =>
                    setSeats((v) => v.map((x, j) => (j === i ? { ...x, address: e.target.value.trim() } : x)))
                  }
                  style={{ flex: 1, minWidth: 220 }}
                  spellCheck={false}
                />
                <select
                  value={s.roles}
                  onChange={(e) =>
                    setSeats((v) => v.map((x, j) => (j === i ? { ...x, roles: Number(e.target.value) } : x)))
                  }
                  style={{ width: 'auto' }}
                >
                  <option value={Role.OWNER | Role.APPROVER}>Owner and approver</option>
                  <option value={Role.APPROVER}>Approver</option>
                  <option value={Role.EXECUTOR}>Executor</option>
                  <option value={Role.GUARDIAN}>Guardian</option>
                  <option value={Role.PROPOSER}>Proposer (an automation)</option>
                </select>
                <button className="btn ghost sm" onClick={() => setSeats((v) => v.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => setSeats((v) => [...v, { address: '', roles: Role.APPROVER }])}
          >
            Add a signer
          </button>

          <div className="row wrap small faint" style={{ marginTop: 14, gap: 12 }}>
            <span>{counts.owners} owner{counts.owners === 1 ? '' : 's'}</span>
            <span>{counts.approvers} approver{counts.approvers === 1 ? '' : 's'}</span>
            <span>{counts.executors} executor{counts.executors === 1 ? '' : 's'}</span>
            <span>{counts.guardians} guardian{counts.guardians === 1 ? '' : 's'}</span>
          </div>
        </div>

        {!CONFIGURED ? (
          <Notice kind="warn">
            No package is configured for this network. Publish with{' '}
            <code className="mono">sui/scripts/publish.sh</code> and set{' '}
            <code className="mono">NEXT_PUBLIC_SKUR_PACKAGE_ID</code>.
          </Notice>
        ) : null}
        {!me ? <Notice kind="warn">Connect a wallet to create a vault.</Notice> : null}
        {duplicates ? <Notice kind="bad">An address appears twice.</Notice> : null}
        {badRoles.length > 0 ? (
          <Notice kind="bad">
            A guardian cannot also hold a treasury role. The contract would refuse this roster.
          </Notice>
        ) : null}
        {countErrors.length > 0 ? (
          <Notice kind="bad">
            <strong>This template needs a larger roster.</strong>
            <ul className="reasons">
              {countErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {tx.error ? <Notice kind="bad">{tx.error}</Notice> : null}

        <button className="btn primary" disabled={!ready || Boolean(tx.pending)} onClick={create}>
          {tx.pending === 'create' ? 'Creating…' : 'Create the vault'}
        </button>
        <p className="small faint">
          One transaction creates the vault, sets the policy, installs the signers and approves SUI.
          If any part is invalid, nothing is created.
        </p>
      </div>
    </div>
  );
}
