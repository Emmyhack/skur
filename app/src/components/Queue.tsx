'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import {
  KIND_LABELS,
  Kind,
  Role,
  Status,
  Tier,
  describeReasons,
  fmtDuration,
  fmtTimestamp,
  hasRole,
  policyReductions,
  tx as build,
  type Proposal,
  type VaultView,
} from '@skur/sdk';
import { PACKAGE_ID } from '@/config';
import type { TxState } from '@/hooks/useVault';
import { Addr, Amount, Countdown, Empty, Notice, StatusPill, TierPill } from './ui';

/**
 * The queue, and the actions on it.
 *
 * Every button is gated on the role the contract requires, so a signer is never offered an action
 * the vault would refuse. The requirement shown is the one pinned on the proposal; at execution
 * the vault re-derives it and applies whichever is stricter, which is why a payment can need more
 * than this says but never less.
 */
export function Queue({ view, tx }: { view: VaultView; tx: TxState }) {
  const account = useCurrentAccount();
  const me = account?.address;
  const roles = me ? (view.members.find((m) => m.address === me)?.roles ?? 0) : 0;
  const pending = view.proposals.filter((p) => p.status === Status.PENDING);
  const settled = view.proposals.filter((p) => p.status !== Status.PENDING);

  return (
    <div className="stack">
      {tx.error ? <Notice kind="bad">{tx.error}</Notice> : null}
      <div className="card">
        <h3>Awaiting action</h3>
        <p className="small soft">
          {pending.length === 0
            ? 'Nothing is waiting.'
            : `${pending.length} proposal${pending.length === 1 ? '' : 's'} open.`}
        </p>
        {pending.length === 0 ? (
          <Empty>The queue is empty.</Empty>
        ) : (
          <div className="stack" style={{ marginTop: 14 }}>
            {pending.map((p) => (
              <ProposalCard key={p.id.toString()} p={p} view={view} roles={roles} me={me} tx={tx} />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>History</h3>
        {settled.length === 0 ? (
          <Empty>Nothing has settled yet.</Empty>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>What</th>
                <th>Amount</th>
                <th>To</th>
                <th>Outcome</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {settled.map((p) => (
                <tr key={p.id.toString()}>
                  <td className="mono faint">{p.id.toString()}</td>
                  <td>{KIND_LABELS[p.kind]}</td>
                  <td>
                    {p.kind === Kind.TRANSFER && p.asset ? (
                      <Amount value={p.amount} coinType={p.asset} />
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    {p.kind === Kind.TRANSFER ? <Addr value={p.recipient} /> : <span className="faint">—</span>}
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td className="small faint">{fmtTimestamp(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  p,
  view,
  roles,
  me,
  tx,
}: {
  p: Proposal;
  view: VaultView;
  roles: number;
  me: string | undefined;
  tx: TxState;
}) {
  const id = p.id;
  const vaultId = view.vault.id;
  const now = Date.now();
  const liveApprovals = p.approvals.filter((a) =>
    hasRole(view.members.find((m) => m.address === a)?.roles ?? 0, Role.APPROVER),
  ).length;
  const liveConfirmations = p.confirmations.filter((a) =>
    hasRole(view.members.find((m) => m.address === a)?.roles ?? 0, Role.GUARDIAN),
  ).length;

  const isTransfer = p.kind === Kind.TRANSFER;
  const voteRole = isTransfer ? Role.APPROVER : Role.OWNER;
  const alreadyApproved = me ? p.approvals.includes(me) : false;
  const alreadyConfirmed = me ? p.confirmations.includes(me) : false;
  const alreadyRejected = me ? p.rejections.includes(me) : false;
  const liveRejections = p.rejections.filter((a) =>
    hasRole(view.members.find((m) => m.address === a)?.roles ?? 0, voteRole),
  ).length;

  const approvalsMet = liveApprovals >= p.reqApprovals;
  const guardiansMet = liveConfirmations >= p.reqGuardians;
  const timeMet = now >= p.executableAt;
  const canExecute = approvalsMet && guardiansMet && timeMet;

  // A guardian can veto exactly what the contract lets them veto, and nothing else.
  const vetoable =
    p.reductionMask !== 0 ||
    (isTransfer && p.tier === Tier.CRITICAL) ||
    p.kind === Kind.RECOVERY ||
    p.kind === Kind.MODE_RELAX;

  const executeTx = () => {
    if (isTransfer && p.asset)
      return build.executeTransfer(PACKAGE_ID, { vaultId, coinType: p.asset, proposalId: id });
    if (p.kind === Kind.POLICY_UPDATE) return build.executePolicy(PACKAGE_ID, vaultId, id);
    if (p.kind === Kind.MEMBER_SET) return build.executeMember(PACKAGE_ID, vaultId, id);
    if (p.kind === Kind.RECIPIENT_TRUST)
      return build.executeRecipientTrust(PACKAGE_ID, vaultId, id);
    if (p.kind === Kind.MODE_RELAX) return build.executeModeRelax(PACKAGE_ID, vaultId, id);
    if (p.kind === Kind.RECOVERY) return build.executeRecovery(PACKAGE_ID, vaultId, id);
    if (p.kind === Kind.ASSET_LIMITS && p.asset)
      return build.executeAssetLimits(PACKAGE_ID, { vaultId, coinType: p.asset, proposalId: id });
    return null;
  };

  // Executing a payment takes the executor role; settling a governance change takes any member,
  // because its authorization is the owner approvals already recorded on it.
  const mayExecute = isTransfer ? hasRole(roles, Role.EXECUTOR) : roles !== 0;
  const reasons = describeReasons(p.reasons);
  const reductions = p.newPolicy ? policyReductions(view.vault.policy, p.newPolicy) : [];

  return (
    <div className="card sunk">
      <div className="row wrap">
        <span className="mono faint">#{id.toString()}</span>
        <strong>{KIND_LABELS[p.kind]}</strong>
        {isTransfer ? <TierPill tier={p.tier} /> : null}
        {p.reductionMask !== 0 ? <span className="pill critical">weakens the vault</span> : null}
        <span className="grow" />
        <span className="small faint">expires {fmtTimestamp(p.expiresAt)}</span>
      </div>

      {isTransfer && p.asset ? (
        <div className="row wrap" style={{ marginTop: 10 }}>
          <h3>
            <Amount value={p.amount} coinType={p.asset} />
          </h3>
          <span className="soft">to</span>
          <Addr value={p.recipient} />
          {p.exposureBps > 0 ? (
            <span className="small faint">{(p.exposureBps / 100).toFixed(2)}% of holdings</span>
          ) : null}
        </div>
      ) : null}
      {p.memo ? <p className="small soft" style={{ marginTop: 6 }}>{p.memo}</p> : null}

      {p.kind === Kind.MEMBER_SET ? (
        <p className="small soft" style={{ marginTop: 8 }}>
          {p.memberRoles === 0 ? 'Remove ' : 'Set roles for '}
          <Addr value={p.member} />
          {p.memberRoles !== 0 ? ` to ${p.memberRoles}` : ''}
        </p>
      ) : null}
      {p.kind === Kind.RECOVERY ? (
        <p className="small soft" style={{ marginTop: 8 }}>
          Replace <Addr value={p.memberPrev} /> with <Addr value={p.member} />, same roles. Any
          owner can cancel this before it executes.
        </p>
      ) : null}

      {reasons.length > 0 ? (
        <>
          <p className="small soft" style={{ marginTop: 10 }}>
            Scored this way because:
          </p>
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : null}
      {reductions.length > 0 ? (
        <>
          <p className="small" style={{ marginTop: 10, color: 'var(--bad)' }}>
            This change gives up:
          </p>
          <ul className="reasons">
            {reductions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="row wrap" style={{ marginTop: 12, gap: 14 }}>
        <span className="small">
          <strong>
            {liveApprovals}/{p.reqApprovals}
          </strong>{' '}
          <span className="soft">approvals</span>
          {liveApprovals < p.approvals.length ? (
            <span className="faint"> ({p.approvals.length - liveApprovals} no longer count)</span>
          ) : null}
        </span>
        {p.reqGuardians > 0 ? (
          <span className="small">
            <strong>
              {liveConfirmations}/{p.reqGuardians}
            </strong>{' '}
            <span className="soft">guardian</span>
          </span>
        ) : null}
        <span className="small">
          <span className="soft">executable </span>
          <Countdown to={p.executableAt} />
        </span>
      </div>

      <div className="row wrap" style={{ marginTop: 14 }}>
        <button
          className="btn primary sm"
          disabled={!hasRole(roles, voteRole) || alreadyApproved || Boolean(tx.pending)}
          onClick={() => tx.run(build.approve(PACKAGE_ID, vaultId, id), `approve-${id}`)}
          title={
            !hasRole(roles, voteRole)
              ? isTransfer
                ? 'Approving a payment takes the approver role'
                : 'Approving a governance change takes the owner role'
              : alreadyApproved
                ? 'You have already approved this'
                : undefined
          }
        >
          {alreadyApproved ? 'Approved' : 'Approve'}
        </button>

        <button
          className="btn sm"
          disabled={!hasRole(roles, voteRole) || alreadyRejected || Boolean(tx.pending)}
          onClick={() => tx.run(build.reject(PACKAGE_ID, vaultId, id), `reject-${id}`)}
          title={
            alreadyRejected
              ? 'You have already rejected this'
              : `Takes ${p.reqApprovals} rejection${p.reqApprovals === 1 ? '' : 's'} to turn this down — as many as it needs to be approved`
          }
        >
          {alreadyRejected ? 'Rejected' : `Reject${liveRejections > 0 ? ` (${liveRejections}/${p.reqApprovals})` : ''}`}
        </button>

        {p.reqGuardians > 0 || vetoable ? (
          <button
            className="btn sm"
            disabled={!hasRole(roles, Role.GUARDIAN) || alreadyConfirmed || Boolean(tx.pending)}
            onClick={() => tx.run(build.confirm(PACKAGE_ID, vaultId, id), `confirm-${id}`)}
          >
            {alreadyConfirmed ? 'Confirmed' : 'Confirm as guardian'}
          </button>
        ) : null}

        {vetoable ? (
          <button
            className="btn danger sm"
            disabled={!hasRole(roles, Role.GUARDIAN) || Boolean(tx.pending)}
            onClick={() => tx.run(build.veto(PACKAGE_ID, vaultId, id), `veto-${id}`)}
            title="Vetoing also raises the vault to Elevated"
          >
            Veto
          </button>
        ) : null}

        <button
          className="btn sm"
          disabled={!mayExecute || !canExecute || Boolean(tx.pending)}
          onClick={() => {
            const t = executeTx();
            if (t) tx.run(t, `execute-${id}`);
          }}
          title={
            !mayExecute
              ? 'Executing a payment takes the executor role'
              : !approvalsMet
                ? 'Not enough approvals from current signers'
                : !guardiansMet
                  ? 'Still needs a guardian confirmation'
                  : !timeMet
                    ? 'The waiting period has not elapsed'
                    : undefined
          }
        >
          Execute
        </button>

        <span className="grow" />

        <button
          className="btn ghost sm"
          disabled={
            (p.proposer !== me && !hasRole(roles, Role.OWNER)) || Boolean(tx.pending)
          }
          onClick={() => tx.run(build.cancel(PACKAGE_ID, vaultId, id), `cancel-${id}`)}
        >
          Cancel
        </button>
        {now >= p.expiresAt ? (
          <button
            className="btn ghost sm"
            disabled={Boolean(tx.pending)}
            onClick={() => tx.run(build.expire(PACKAGE_ID, vaultId, id), `expire-${id}`)}
          >
            Retire expired
          </button>
        ) : null}
      </div>

      {p.reductionMask !== 0 ? (
        <p className="small faint" style={{ marginTop: 10 }}>
          A weakening waits {fmtDuration(view.vault.policy.policyChangeDelay)} and any guardian can
          stop it until then.
        </p>
      ) : null}
    </div>
  );
}
