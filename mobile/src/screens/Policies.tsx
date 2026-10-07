import { useState } from 'react';
import { Text, View } from 'react-native';
import { Role, fmtAmount, fmtDuration, hasRole, tx as build, type Policy } from '@skur/sdk';
import {
  BackButton,
  Button,
  Card,
  Field,
  Input,
  Notice,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  TopBar,
  TxStatus,
} from '../components/ui';
import { CheckItem } from '../components/kit';
import { coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { PACKAGE_ID } from '../lib/config';
import { useTx } from '../hooks/useTx';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

/**
 * Screen 17 — the spending policy, shown as the rules it actually is: which band an amount falls
 * into, what each band demands, and what unknown recipients wait. Editing routes through
 * governance like every other change — the phone proposes, it never decrees.
 */
export function Policies({ onBack }: { onBack: () => void }) {
  const C = useTheme();
  const { vaultId, address } = useStore();
  const q = useVaultView(vaultId);
  const tx = useTx(vaultId);
  const [editing, setEditing] = useState(false);
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [critical, setCritical] = useState('');

  if (q.isLoading || !q.data) {
    return (
      <Screen top={<TopBar left={<BackButton onPress={onBack} />} title="Spending Policies" />}>
        <Skeleton lines={4} />
      </Screen>
    );
  }

  const p = q.data.vault.policy;
  const asset = q.data.assets[0];
  const d = asset ? coinDecimals(asset.coinType) : 9;
  const sym = asset ? coinSymbol(asset.coinType) : '';
  const myRoles = address ? (q.data.members.find((m) => m.address === address)?.roles ?? 0) : 0;
  const isOwner = hasRole(myRoles, Role.OWNER);

  const parsed = {
    low: low === '' ? p.approvalsLow : Number(low),
    high: high === '' ? p.approvalsHigh : Number(high),
    critical: critical === '' ? p.approvalsCritical : Number(critical),
  };
  const sane =
    [parsed.low, parsed.high, parsed.critical].every((n) => Number.isInteger(n) && n >= 1 && n <= 20) &&
    parsed.low <= parsed.high &&
    parsed.high <= parsed.critical;
  const changed = parsed.low !== p.approvalsLow || parsed.high !== p.approvalsHigh || parsed.critical !== p.approvalsCritical;

  const propose = () => {
    const next: Policy = { ...p, approvalsLow: parsed.low, approvalsHigh: parsed.high, approvalsCritical: parsed.critical };
    void tx
      .run(() => build.proposePolicy(PACKAGE_ID, { vaultId: vaultId!, policy: next }), 'Propose this policy change')
      .then((digest) => {
        if (digest) setEditing(false);
      });
  };

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Spending Policies" />}
      footer={
        isOwner ? (
          <View style={{ gap: 10 }}>
            <TxStatus state={tx.state} />
            <Button kind="secondary" icon="edit-2" onPress={() => setEditing(true)} testID="edit-policies">
              Edit Policies
            </Button>
          </View>
        ) : null
      }
    >
      <View style={{ gap: 16 }}>
        <SectionLabel>Policy rules</SectionLabel>
        <Card>
          <CheckItem
            title={asset ? `Under ${fmtAmount(asset.limits.lowMax, d)} ${sym}` : 'Routine payments'}
            detail={`${p.approvalsLow} approval${p.approvalsLow === 1 ? '' : 's'} required, no wait`}
          />
          <CheckItem
            title={
              asset
                ? `${fmtAmount(asset.limits.lowMax, d)} – ${fmtAmount(asset.limits.highMax, d)} ${sym}`
                : 'High-risk payments'
            }
            detail={`${p.approvalsHigh} approvals required, waits ${fmtDuration(p.delayHigh)}`}
          />
          <CheckItem
            title={asset ? `Over ${fmtAmount(asset.limits.highMax, d)} ${sym}` : 'Critical payments'}
            detail={`${p.approvalsCritical} approvals${p.guardianRequiredCritical ? ` + ${p.guardianThreshold} guardian` : ''}, waits ${fmtDuration(p.delayCritical)}`}
          />
          <CheckItem
            title="Unknown recipients"
            detail={`${fmtDuration(p.recipientActivationDelay)} timelock before a new address can be paid`}
            ok="warn"
            icon="clock"
          />
          <CheckItem
            title="Loss envelope"
            detail={
              p.envelopeBps === 0
                ? 'Off'
                : `At most ${p.envelopeBps / 100}% of the treasury may leave per ${fmtDuration(p.envelopeWindow)}`
            }
            icon="umbrella"
          />
        </Card>

        {asset ? (
          <Card>
            <SectionLabel>Per-asset caps · {sym}</SectionLabel>
            <CheckItem
              title="Per payment"
              detail={asset.limits.perTxMax === 0n ? 'No cap' : `${fmtAmount(asset.limits.perTxMax, d)} ${sym}`}
              icon="maximize-2"
            />
            <CheckItem
              title="Per day"
              detail={asset.limits.dailyMax === 0n ? 'No cap' : `${fmtAmount(asset.limits.dailyMax, d)} ${sym}`}
              icon="calendar"
            />
          </Card>
        ) : null}

        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
          These rules are enforced by the vault object itself, not by this app. Changing them is a
          governance proposal: it collects {p.governanceThreshold} owner approval
          {p.governanceThreshold === 1 ? '' : 's'}, waits {fmtDuration(p.policyChangeDelay)}, and any
          guardian can veto a change that weakens the vault.
        </Text>
      </View>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit policies">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Field label="Approvals for routine payments">
            <Input value={low} onChangeText={setLow} placeholder={String(p.approvalsLow)} keyboardType="number-pad" />
          </Field>
          <Field label="Approvals for high-risk payments">
            <Input value={high} onChangeText={setHigh} placeholder={String(p.approvalsHigh)} keyboardType="number-pad" />
          </Field>
          <Field label="Approvals for critical payments">
            <Input value={critical} onChangeText={setCritical} placeholder={String(p.approvalsCritical)} keyboardType="number-pad" />
          </Field>
          {!sane ? (
            <Notice tone="warn">Each band must need at least one approval, and never fewer than the band below it.</Notice>
          ) : null}
          <Button icon="arrow-up-right" disabled={!sane || !changed || tx.busy} loading={tx.busy} onPress={propose}>
            Open the policy proposal
          </Button>
          <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
            Everything not shown here carries over unchanged. Loosening any rule waits{' '}
            {fmtDuration(p.policyChangeDelay)} and can be vetoed.
          </Text>
        </View>
      </Sheet>
    </Screen>
  );
}
