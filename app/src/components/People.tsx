'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useState } from 'react';
import {
  ROLE_LABELS,
  Role,
  Trust,
  describeRoles,
  fmtTimestamp,
  hasRole,
  rolesValid,
  tx as build,
  type VaultView,
} from '@skur/sdk';
import { PACKAGE_ID } from '@/config';
import type { TxState } from '@/hooks/useVault';
import { Addr, Countdown, Empty, Notice, Roles, TrustPill } from './ui';

/** Signers and recipients: who can act, and who can be paid. */
export function People({ view, tx }: { view: VaultView; tx: TxState }) {
  const account = useCurrentAccount();
  const me = account?.address;
  const roles = me ? (view.members.find((m) => m.address === me)?.roles ?? 0) : 0;
  const isOwner = hasRole(roles, Role.OWNER);

  const [newMember, setNewMember] = useState('');
  const [newRoles, setNewRoles] = useState<number>(Role.APPROVER);
  const [newRecipient, setNewRecipient] = useState('');
  const [label, setLabel] = useState('');
  const [lost, setLost] = useState('');
  const [replacement, setReplacement] = useState('');

  const rolesOk = rolesValid(newRoles);

  return (
    <div className="stack">
      {tx.error ? <Notice kind="bad">{tx.error}</Notice> : null}

      <div className="card">
        <h3>Signers</h3>
        <p className="small soft">
          A guardian holds no treasury role and no treasury member holds the guardian role. The
          contract refuses any other arrangement.
        </p>
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Address</th>
              <th>Roles</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.members.map((m) => (
              <tr key={m.address}>
                <td>
                  <Addr value={m.address} />
                  {m.address === me ? <span className="pill" style={{ marginLeft: 7 }}>you</span> : null}
                </td>
                <td>
                  <Roles bits={m.roles} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn ghost sm"
                    disabled={!isOwner || Boolean(tx.pending)}
                    onClick={() =>
                      tx.run(
                        build.proposeMember(PACKAGE_ID, {
                          vaultId: view.vault.id,
                          member: m.address,
                          roles: 0,
                        }),
                        `remove-${m.address}`,
                      )
                    }
                    title={isOwner ? undefined : 'Changing signers takes the owner role'}
                  >
                    Propose removal
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="card sunk" style={{ marginTop: 16 }}>
          <h4>Add a signer</h4>
          <p className="small soft">
            Granting a role is treated as weakening the vault — a new key is a new way in — so it
            waits out the policy-change delay and any guardian can veto it.
          </p>
          <div className="row wrap" style={{ marginTop: 12, alignItems: 'flex-end' }}>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label htmlFor="member">Address</label>
              <input
                id="member"
                placeholder="0x…"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value.trim())}
                spellCheck={false}
              />
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label>Roles</label>
              <div className="row wrap">
                {[Role.OWNER, Role.APPROVER, Role.EXECUTOR, Role.GUARDIAN, Role.PROPOSER].map((r) => (
                  <label key={r} className="row small" style={{ margin: 0, gap: 5 }}>
                    <input
                      type="checkbox"
                      style={{ width: 15, height: 15 }}
                      checked={(newRoles & r) !== 0}
                      onChange={(e) => setNewRoles((v) => (e.target.checked ? v | r : v & ~r))}
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
            </div>
            <button
              className="btn primary"
              disabled={
                !isOwner ||
                !rolesOk ||
                !/^0x[0-9a-fA-F]{1,64}$/.test(newMember) ||
                Boolean(tx.pending)
              }
              onClick={() =>
                tx
                  .run(
                    build.proposeMember(PACKAGE_ID, {
                      vaultId: view.vault.id,
                      member: newMember,
                      roles: newRoles,
                    }),
                    'add-member',
                  )
                  .then((d) => {
                    if (d) setNewMember('');
                  })
              }
            >
              Propose
            </button>
          </div>
          {!rolesOk ? (
            <p className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>
              {newRoles === 0
                ? 'Pick at least one role.'
                : 'A guardian cannot also hold a treasury role. The contract would refuse this.'}
            </p>
          ) : (
            <p className="small faint" style={{ marginTop: 8 }}>
              {describeRoles(newRoles).join(', ') || '—'}
            </p>
          )}
        </div>

        <div className="card sunk" style={{ marginTop: 16 }}>
          <h4>Replace a lost key</h4>
          <p className="small soft">
            A guardian opens this. It waits {Math.round(view.vault.policy.recoveryDelay / 3_600_000)}{' '}
            hours, any owner can cancel it, the roles move across unchanged, and the vault comes out
            of it in Elevated.
          </p>
          <div className="row wrap" style={{ marginTop: 12, alignItems: 'flex-end' }}>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label htmlFor="lost">Lost signer</label>
              <input id="lost" placeholder="0x…" value={lost} onChange={(e) => setLost(e.target.value.trim())} />
            </div>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label htmlFor="repl">Replacement</label>
              <input
                id="repl"
                placeholder="0x…"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value.trim())}
              />
            </div>
            <button
              className="btn"
              disabled={
                !hasRole(roles, Role.GUARDIAN) ||
                !/^0x[0-9a-fA-F]{1,64}$/.test(lost) ||
                !/^0x[0-9a-fA-F]{1,64}$/.test(replacement) ||
                Boolean(tx.pending)
              }
              onClick={() =>
                tx.run(
                  build.proposeRecovery(PACKAGE_ID, {
                    vaultId: view.vault.id,
                    lost,
                    replacement,
                  }),
                  'recovery',
                )
              }
              title={hasRole(roles, Role.GUARDIAN) ? undefined : 'Recovery is opened by a guardian'}
            >
              Open recovery
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recipients</h3>
        <p className="small soft">
          An address the vault has never paid is escalated every time. Registering one starts it at
          the restrictive default and makes it serve an activation delay.
        </p>
        {view.recipients.length === 0 ? (
          <Empty>No recipients registered. Payments can still be made; they are just escalated.</Empty>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Address</th>
                <th>Label</th>
                <th>Standing</th>
                <th>Paid</th>
                <th>Activates</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.recipients.map((r) => (
                <tr key={r.address}>
                  <td>
                    <Addr value={r.address} />
                  </td>
                  <td className="small soft">{r.label || '—'}</td>
                  <td>
                    <TrustPill trust={r.trust} />
                  </td>
                  <td className="small">{r.paidCount}</td>
                  <td className="small">
                    {r.activatesAt > Date.now() ? (
                      <Countdown to={r.activatesAt} />
                    ) : (
                      <span className="faint">active</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.trust !== Trust.BLOCKED ? (
                      <button
                        className="btn ghost sm"
                        disabled={!hasRole(roles, Role.GUARDIAN) || Boolean(tx.pending)}
                        onClick={() =>
                          tx.run(
                            build.guardianRestrict(PACKAGE_ID, {
                              vaultId: view.vault.id,
                              recipient: r.address,
                              trust: Trust.BLOCKED,
                            }),
                            `block-${r.address}`,
                          )
                        }
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        className="btn ghost sm"
                        disabled={!hasRole(roles, Role.OWNER) || Boolean(tx.pending)}
                        onClick={() =>
                          tx.run(
                            build.proposeRecipientTrust(PACKAGE_ID, {
                              vaultId: view.vault.id,
                              recipient: r.address,
                              trust: Trust.VERIFIED,
                            }),
                            `unblock-${r.address}`,
                          )
                        }
                        title="Lifting a block is a weakening: it waits and can be vetoed"
                      >
                        Propose unblocking
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="card sunk" style={{ marginTop: 16 }}>
          <h4>Register a recipient</h4>
          <div className="row wrap" style={{ marginTop: 12, alignItems: 'flex-end' }}>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label htmlFor="rec">Address</label>
              <input
                id="rec"
                placeholder="0x…"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value.trim())}
                spellCheck={false}
              />
            </div>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label htmlFor="lbl">Label</label>
              <input
                id="lbl"
                placeholder="Payroll, AWS, a vendor name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
              />
            </div>
            <button
              className="btn primary"
              disabled={
                !isOwner || !/^0x[0-9a-fA-F]{1,64}$/.test(newRecipient) || Boolean(tx.pending)
              }
              onClick={() =>
                tx
                  .run(
                    build.registerRecipient(PACKAGE_ID, {
                      vaultId: view.vault.id,
                      recipient: newRecipient,
                      label,
                    }),
                    'register',
                  )
                  .then((d) => {
                    if (d) {
                      setNewRecipient('');
                      setLabel('');
                    }
                  })
              }
              title={isOwner ? undefined : 'Registering a recipient takes the owner role'}
            >
              Register
            </button>
          </div>
          <p className="small faint" style={{ marginTop: 8 }}>
            Takes effect at once, because trust &ldquo;new&rdquo; with an activation delay is
            stricter than unknown. Raising it further is a governance action with a timelock.
          </p>
        </div>

        <p className="small faint" style={{ marginTop: 14 }}>
          Last registered {view.recipients.length > 0 ? fmtTimestamp(Math.max(...view.recipients.map((r) => r.registeredAt))) : '—'}
        </p>
      </div>
    </div>
  );
}
