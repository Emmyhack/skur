import { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Mode,
  Role,
  computeMaxLoss,
  fmtAmount,
  fmtDuration,
  hasRole,
  postureItems,
  tx as build,
} from '@skur/sdk';
import {
  Button,
  Card,
  CircleIcon,
  Icon,
  KV,
  Notice,
  Screen,
  SectionLabel,
  TopBar,
  TxStatus,
} from '../components/ui';
import { Meter } from '../components/kit';
import { coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { PACKAGE_ID } from '../lib/config';
import { useTx } from '../hooks/useTx';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

export function Security() {
  const C = useTheme();
  const { vaultId, address } = useStore();
  const q = useVaultView(vaultId);
  const tx = useTx(vaultId);

  const roles = address ? (q.data?.members.find((m) => m.address === address)?.roles ?? 0) : 0;
  const canRaise = hasRole(roles, Role.GUARDIAN) || hasRole(roles, Role.OWNER);

  const posture = useMemo(
    () =>
      q.data
        ? postureItems({
            policy: q.data.vault.policy,
            guardians: q.data.vault.guardianCount,
            assets: q.data.assets.map((a) => ({ symbol: coinSymbol(a.coinType), limits: a.limits })),
          })
        : [],
    [q.data],
  );

  if (!q.data) {
    return (
      <Screen top={<TopBar title="Security" />}>
        <Text style={{ fontFamily: F.body, color: C.text2 }}>Reading…</Text>
      </Screen>
    );
  }

  const v = q.data;
  const p = v.vault.policy;
  const holding = posture.filter((i) => i.ok === 'ok').length;
  const allOk = holding === posture.length;

  return (
    <Screen
      top={<TopBar title="Security Center" />}
      footer={tx.state.phase !== 'idle' ? <TxStatus state={tx.state} /> : null}
    >
      <View style={{ gap: 20 }}>
        <Card>
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <CircleIcon name="shield" size={56} tone={allOk ? 'ok' : 'warn'} />
            <Text style={{ fontFamily: F.display, fontSize: 20, color: C.text }}>
              {allOk ? 'Your assets are protected' : 'Posture has gaps'}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text2 }}>
              Enforced by the vault object, not by this app.
            </Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <Meter
              value={posture.length === 0 ? 0 : holding / posture.length}
              label="Controls holding"
              trailing={`${holding} of ${posture.length}`}
            />
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>What holds</SectionLabel>
          <Card>
            {posture.map((item, i) => (
              <View
                key={item.text}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 7 }}
              >
                <View style={{ paddingTop: 2 }}>
                  <Icon
                    name={item.ok === 'ok' ? 'check-circle' : item.ok === 'warn' ? 'alert-circle' : 'x-circle'}
                    size={15}
                    color={item.ok === 'ok' ? C.success : item.ok === 'warn' ? C.warning : C.error}
                  />
                </View>
                <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.text2 }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </Card>
          <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
            Confirmed controls and obvious gaps. This is not a score and does not claim to measure
            absolute security.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>In an incident</SectionLabel>
          {canRaise ? (
            <View style={{ gap: 10 }}>
              <Button
                kind="secondary"
                icon="alert-triangle"
                disabled={v.vault.mode >= Mode.ELEVATED || tx.busy}
                onPress={() =>
                  tx.run(
                    () => build.raiseMode(PACKAGE_ID, { vaultId: vaultId!, mode: Mode.ELEVATED }),
                    'Raise this vault to Elevated',
                  )
                }
              >
                Raise to Elevated
              </Button>
              <Button
                kind="danger"
                icon="lock"
                disabled={v.vault.mode === Mode.LOCKDOWN || tx.busy}
                onPress={() =>
                  tx.run(
                    () => build.raiseMode(PACKAGE_ID, { vaultId: vaultId!, mode: Mode.LOCKDOWN }),
                    'Freeze this vault',
                  )
                }
              >
                Freeze the vault
              </Button>
              <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text3 }}>
                Freezing is immediate and stops all outgoing execution. Deposits keep working.
                Reopening needs {p.governanceThreshold} owner
                {p.governanceThreshold === 1 ? '' : 's'}, {p.guardianThreshold} guardian
                {p.guardianThreshold === 1 ? '' : 's'} and {fmtDuration(p.policyChangeDelay)} —
                whoever froze it cannot lift it alone.
              </Text>
            </View>
          ) : (
            <Notice tone="info">
              Raising the posture takes an owner or a guardian. This device&apos;s key holds
              neither.
            </Notice>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>Maximum possible loss</SectionLabel>
          {v.assets.map((a) => {
            const r = computeMaxLoss(p, a.limits, a.balance, v.vault.mode);
            const d = coinDecimals(a.coinType);
            return (
              <Card key={a.coinType}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text, marginBottom: 4 }}>
                  {coinSymbol(a.coinType)}
                </Text>
                <KV k="With no delay" v={`${fmtAmount(r.immediate, d)} — ${r.immediateBinding}`} />
                <KV k="Within a day" v={`${fmtAmount(r.day, d)} — ${r.dayBinding}`} />
                <KV k="Largest payments wait" v={fmtDuration(r.criticalDelay)} last />
              </Card>
            );
          })}
          <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
            Assumes every signer a tier needs is compromised and cooperating, and that no guardian
            acts. An upper bound under those assumptions, never a guarantee. A 24-hour bucket
            anchors on its first payment, so up to two days&apos; allowance can leave across a
            boundary.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
