import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  KIND_LABELS,
  Kind,
  Role,
  Status,
  Tier,
  Trust,
  describeReasons,
  fmtAmount,
  fmtDuration,
  fmtRelative,
  fmtTimestamp,
  hasRole,
  policyReductions,
  short,
  tx as build,
} from '@skur/sdk';
import {
  Address,
  BackButton,
  Button,
  Card,
  KV,
  Notice,
  Screen,
  SectionLabel,
  StatusBadge,
  TierBadge,
  TopBar,
  TxStatus,
  Sheet,
} from '../components/ui';
import { CheckItem, Meter, TimelineStep } from '../components/kit';
import { coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { PACKAGE_ID } from '../lib/config';
import { useTx } from '../hooks/useTx';
import { useTransferPreview, useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

/**
 * Screens 12–14 in one place: the details of a proposal, its approval flow as a timeline, the
 * review-before-signing checks, and the actions this device's key is actually allowed to take.
 *
 * Every button is gated on the role the contract requires, so a signer is never offered something
 * the vault would refuse. The requirements shown are the ones pinned when the proposal was opened;
 * at execution the vault re-derives them and applies whichever is stricter, which is why a payment
 * can end up needing more than this says and never less.
 */
export function TxDetail({ id, onBack }: { id: bigint; onBack: () => void }) {
  const C = useTheme();
  const { vaultId, address } = useStore();
  const q = useVaultView(vaultId);
  const tx = useTx(vaultId);
  const [simulating, setSimulating] = useState(false);

  const p = q.data?.proposals.find((x) => x.id === id);
  const roles = address ? (q.data?.members.find((m) => m.address === address)?.roles ?? 0) : 0;

  const isTransfer = p?.kind === Kind.TRANSFER;
  // The simulation re-runs the vault's own preview for this exact payment, on demand.
  const preview = useTransferPreview({
    vaultId,
    coinType: p?.asset ?? '',
    amount: p?.amount ?? 0n,
    recipient: p?.recipient ?? '',
    sender: address,
    enabled: simulating && Boolean(isTransfer && p?.asset),
  });

  if (!p || !q.data) {
    return (
      <Screen top={<TopBar left={<BackButton onPress={onBack} />} title="Proposal" />}>
        <Text style={{ fontFamily: F.body, color: C.text2 }}>Reading…</Text>
      </Screen>
    );
  }

  const voteRole = isTransfer ? Role.APPROVER : Role.OWNER;
  const canVote = hasRole(roles, voteRole);
  const canExecute = isTransfer ? hasRole(roles, Role.EXECUTOR) : roles !== 0;
  const isGuardian = hasRole(roles, Role.GUARDIAN);

  const live = (set: string[], role: number) =>
    set.filter((a) => hasRole(q.data!.members.find((m) => m.address === a)?.roles ?? 0, role)).length;
  const liveApprovals = live(p.approvals, Role.APPROVER);
  const liveConfirmations = live(p.confirmations, Role.GUARDIAN);
  const liveRejections = live(p.rejections, voteRole);

  const voted = address ? p.approvals.includes(address) : false;
  const rejected = address ? p.rejections.includes(address) : false;
  const confirmed = address ? p.confirmations.includes(address) : false;

  const timeMet = Date.now() >= p.executableAt;
  const ready = liveApprovals >= p.reqApprovals && liveConfirmations >= p.reqGuardians && timeMet;
  const open = p.status === Status.PENDING;

  const vetoable =
    p.reductionMask !== 0 ||
    (isTransfer && p.tier === Tier.CRITICAL) ||
    p.kind === Kind.RECOVERY ||
    p.kind === Kind.MODE_RELAX;

  const reasons = describeReasons(p.reasons);
  const reductions = p.newPolicy ? policyReductions(q.data.vault.policy, p.newPolicy) : [];

  // Screen 14's checks, computed from chain state rather than asserted.
  const recipientRecord = q.data.recipients.find((r) => r.address === p.recipient);
  const trust = recipientRecord?.trust ?? Trust.UNKNOWN;
  const asset = p.asset ? q.data.assets.find((a) => a.coinType === p.asset) : undefined;
  const withinPerTx = !asset || asset.limits.perTxMax === 0n || p.amount <= asset.limits.perTxMax;
  const recipientKnown = trust !== Trust.UNKNOWN && trust !== Trust.BLOCKED;
  const noRedFlags = trust !== Trust.BLOCKED && p.reductionMask === 0;

  const executeTx = () => {
    if (isTransfer && p.asset)
      return build.executeTransfer(PACKAGE_ID, { vaultId: vaultId!, coinType: p.asset, proposalId: id });
    if (p.kind === Kind.POLICY_UPDATE) return build.executePolicy(PACKAGE_ID, vaultId!, id);
    if (p.kind === Kind.MEMBER_SET) return build.executeMember(PACKAGE_ID, vaultId!, id);
    if (p.kind === Kind.RECIPIENT_TRUST) return build.executeRecipientTrust(PACKAGE_ID, vaultId!, id);
    if (p.kind === Kind.MODE_RELAX) return build.executeModeRelax(PACKAGE_ID, vaultId!, id);
    if (p.kind === Kind.RECOVERY) return build.executeRecovery(PACKAGE_ID, vaultId!, id);
    if (p.kind === Kind.ASSET_LIMITS && p.asset)
      return build.executeAssetLimits(PACKAGE_ID, { vaultId: vaultId!, coinType: p.asset, proposalId: id });
    throw new Error('nothing to execute for this kind');
  };

  // Screen 13 — the approval flow, as it stands on chain right now.
  const flow: { title: string; subtitle: string; state: 'done' | 'active' | 'todo' }[] = [
    {
      title: 'Proposed',
      subtitle: `by ${short(p.proposer)} · ${fmtRelative(p.createdAt)}`,
      state: 'done',
    },
    ...p.approvals.map((a) => ({
      title: 'Approved',
      subtitle: short(a),
      state: 'done' as const,
    })),
    ...Array.from({ length: Math.max(0, p.reqApprovals - liveApprovals) }).map((_, i) => ({
      title: 'Approval',
      subtitle: i === 0 && canVote && !voted ? 'Yours, if you give it' : 'Awaiting a signer',
      state: (i === 0 ? 'active' : 'todo') as 'active' | 'todo',
    })),
    ...(p.reqGuardians > 0
      ? [
          {
            title: 'Guardian confirmation',
            subtitle: `${liveConfirmations} of ${p.reqGuardians}`,
            state: (liveConfirmations >= p.reqGuardians ? 'done' : 'todo') as 'done' | 'todo',
          },
        ]
      : []),
    {
      title: p.status === Status.EXECUTED ? 'Executed' : 'Execution',
      subtitle:
        p.status === Status.EXECUTED
          ? 'Settled on chain'
          : !timeMet
            ? `Waits until ${fmtTimestamp(p.executableAt)}`
            : ready
              ? 'Ready now'
              : 'After the approvals above',
      state: p.status === Status.EXECUTED ? 'done' : ready && open ? 'active' : 'todo',
    },
  ];

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title={`#${id} · ${KIND_LABELS[p.kind]}`} />}
      footer={
        open ? (
          <View style={{ gap: 10 }}>
            <TxStatus state={tx.state} />
            {canVote ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  style={{ flex: 1 }}
                  testID="action-approve"
                  onPress={() => tx.run(() => build.approve(PACKAGE_ID, vaultId!, id), 'Approve this proposal')}
                  disabled={voted || tx.busy}
                  loading={tx.busy}
                  icon="check"
                >
                  {voted ? 'Approved' : 'Approve'}
                </Button>
                <Button
                  style={{ flex: 1 }}
                  kind="secondary"
                  testID="action-reject"
                  onPress={() => tx.run(() => build.reject(PACKAGE_ID, vaultId!, id), 'Reject this proposal')}
                  disabled={rejected || tx.busy}
                  icon="x"
                >
                  {rejected ? 'Rejected' : 'Reject'}
                </Button>
              </View>
            ) : null}
            {isGuardian && (p.reqGuardians > 0 || vetoable) ? (
              <Button
                kind="secondary"
                testID="action-confirm"
                onPress={() => tx.run(() => build.confirm(PACKAGE_ID, vaultId!, id), 'Confirm as guardian')}
                disabled={confirmed || tx.busy}
                icon="shield"
              >
                {confirmed ? 'Confirmed' : 'Confirm as guardian'}
              </Button>
            ) : null}
            {isGuardian && vetoable ? (
              <Button
                kind="danger"
                testID="action-veto"
                onPress={() => tx.run(() => build.veto(PACKAGE_ID, vaultId!, id), 'Veto this proposal')}
                disabled={tx.busy}
                icon="slash"
              >
                Veto
              </Button>
            ) : null}
            {canExecute ? (
              <Button
                testID="action-execute"
                onPress={() => tx.run(executeTx, 'Execute this proposal')}
                disabled={!ready || tx.busy}
                icon="arrow-up-right"
              >
                {ready ? 'Execute' : !timeMet ? `Waits until ${fmtTimestamp(p.executableAt)}` : 'Not enough approvals yet'}
              </Button>
            ) : null}
          </View>
        ) : null
      }
    >
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {isTransfer ? <TierBadge tier={p.tier} /> : null}
          <StatusBadge status={p.status} />
          {p.reductionMask !== 0 ? (
            <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.error }}>weakens the vault</Text>
          ) : null}
        </View>

        {isTransfer && p.asset ? (
          <Card>
            <SectionLabel>Leaves the vault</SectionLabel>
            <Text style={{ fontFamily: F.display, fontSize: 30, color: C.text }}>
              {fmtAmount(p.amount, coinDecimals(p.asset), coinSymbol(p.asset))}
            </Text>
            <View style={{ marginTop: 10 }}>
              <SectionLabel>To</SectionLabel>
              <Address value={p.recipient} full />
            </View>
            {p.memo ? (
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.text2, marginTop: 10 }}>{p.memo}</Text>
            ) : null}
          </Card>
        ) : null}

        {isTransfer && p.asset ? (
          <Card>
            <SectionLabel>Details</SectionLabel>
            <KV k="From" v={q.data.vault.name} />
            <KV k="Asset" v={coinSymbol(p.asset)} />
            <KV k="Amount" v={fmtAmount(p.amount, coinDecimals(p.asset))} />
            {p.memo ? <KV k="Purpose" v={p.memo} /> : null}
            <KV k="Risk level" v={<TierBadge tier={p.tier} />} last />
            {open ? (
              <View style={{ marginTop: 12 }}>
                <Button kind="secondary" size="sm" icon="play" onPress={() => setSimulating(true)}>
                  View simulation
                </Button>
              </View>
            ) : null}
          </Card>
        ) : null}

        {p.kind === Kind.RECOVERY ? (
          <Card>
            <SectionLabel>Replace a lost signer</SectionLabel>
            <KV k="Lost" v={<Address value={p.memberPrev} />} />
            <KV k="Replacement" v={<Address value={p.member} />} last />
            <Notice tone="warn">
              The roles move across unchanged and the policy is untouched. Any owner can cancel this
              before it executes.
            </Notice>
          </Card>
        ) : null}

        {reasons.length > 0 ? (
          <Card>
            <SectionLabel>Scored this way because</SectionLabel>
            {reasons.map((r) => (
              <Text key={r} style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
                • {r}
              </Text>
            ))}
          </Card>
        ) : null}

        {reductions.length > 0 ? (
          <Notice tone="bad">
            This change gives up: {reductions.join('; ')}. It waits{' '}
            {fmtDuration(q.data.vault.policy.policyChangeDelay)} and any guardian can stop it.
          </Notice>
        ) : null}

        {open && isTransfer && (canVote || canExecute || isGuardian) ? (
          <Card>
            <SectionLabel>Review before signing</SectionLabel>
            <CheckItem
              title={recipientKnown ? 'Recipient known to this vault' : 'Recipient is new to this vault'}
              detail={
                recipientKnown
                  ? `Paid ${recipientRecord?.paidCount ?? 0} time${(recipientRecord?.paidCount ?? 0) === 1 ? '' : 's'} before`
                  : 'Never paid by this vault — look twice at the address'
              }
              ok={recipientKnown ? true : 'warn'}
            />
            <CheckItem
              title={withinPerTx ? 'Within spending limits' : 'Above the per-payment cap'}
              detail={
                asset && asset.limits.perTxMax !== 0n
                  ? `Cap ${fmtAmount(asset.limits.perTxMax, coinDecimals(asset.coinType))} ${coinSymbol(asset.coinType)}`
                  : 'No per-payment cap is set for this asset'
              }
              ok={withinPerTx ? true : false}
            />
            <CheckItem
              title={noRedFlags ? 'No red flags' : 'Red flags'}
              detail={
                noRedFlags
                  ? 'Recipient is not blocked, and nothing here weakens the vault'
                  : trust === Trust.BLOCKED
                    ? 'This recipient is blocked by the vault'
                    : 'This change weakens the vault'
              }
              ok={noRedFlags}
            />
            <View style={{ marginTop: 8 }}>
              <Meter
                value={p.reqApprovals === 0 ? 1 : liveApprovals / p.reqApprovals}
                label="Required approvals"
                trailing={`${liveApprovals} of ${p.reqApprovals}`}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionLabel>Approval flow</SectionLabel>
          <View style={{ marginTop: 6 }}>
            {flow.map((step, i) => (
              <TimelineStep
                key={`${step.title}-${i}`}
                title={step.title}
                subtitle={step.subtitle}
                state={step.state}
                last={i === flow.length - 1}
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionLabel>What it needs</SectionLabel>
          <KV
            k="Approvals"
            v={`${liveApprovals} of ${p.reqApprovals}${
              liveApprovals < p.approvals.length ? ` (${p.approvals.length - liveApprovals} no longer count)` : ''
            }`}
          />
          {p.reqGuardians > 0 ? (
            <KV k="Guardian confirmations" v={`${liveConfirmations} of ${p.reqGuardians}`} />
          ) : null}
          {liveRejections > 0 ? <KV k="Rejections" v={`${liveRejections} of ${p.reqApprovals}`} /> : null}
          <KV k="Executable" v={timeMet ? 'now' : fmtTimestamp(p.executableAt)} />
          <KV k="Expires" v={fmtTimestamp(p.expiresAt)} />
          <KV k="Opened by" v={<Address value={p.proposer} />} last />
        </Card>

        {!canVote && !canExecute && !isGuardian ? (
          <Notice tone="info">
            This device&apos;s key holds no role that can act on this proposal. You can read it.
          </Notice>
        ) : null}
      </View>

      <Sheet open={simulating} onClose={() => setSimulating(false)} title="Simulation">
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text2 }}>
            The vault&apos;s own preview, re-run against its state right now — the same code
            execution will run.
          </Text>
          {preview.isLoading ? (
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3 }}>Asking the vault…</Text>
          ) : preview.data ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <SectionLabel>It would demand</SectionLabel>
                <TierBadge tier={preview.data.tier} />
              </View>
              <KV k="Approvals" v={String(preview.data.reqApprovals)} />
              <KV k="Guardian" v={preview.data.reqGuardians === 0 ? 'none' : String(preview.data.reqGuardians)} />
              <KV k="Waits" v={preview.data.delay === 0 ? 'no wait' : fmtDuration(preview.data.delay)} />
              <KV k="Share of this asset" v={`${(preview.data.exposureBps / 100).toFixed(2)}%`} last />
            </Card>
          ) : preview.error ? (
            <Notice tone="warn">
              The vault refused the simulation: {preview.error instanceof Error ? preview.error.message : 'it would not execute as-is.'}
            </Notice>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}
