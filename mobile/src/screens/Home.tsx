import { RefreshControl, Text, View } from 'react-native';
import {
  Mode,
  Status,
  describeReasons,
  fmtAmount,
  fmtDuration,
  type VaultView,
} from '@skur/sdk';
import {
  Address,
  Card,
  Empty,
  IconButton,
  KV,
  ModeBadge,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Tape,
  TopBar,
} from '../components/ui';
import { Identicon } from '../components/Identicon';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

export function Home({ onOpenQueue, onSwitch }: { onOpenQueue: () => void; onSwitch: () => void }) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);

  if (q.isLoading) {
    return (
      <Screen top={<TopBar title="Treasury" />}>
        <Text style={{ fontFamily: F.body, color: C.text2 }}>Reading the vault…</Text>
      </Screen>
    );
  }
  if (q.error || !q.data) {
    return (
      <Screen top={<TopBar title="Treasury" right={<IconButton name="repeat" label="Switch vault" onPress={onSwitch} />} />}>
        <Notice tone="bad">
          Could not read that vault. Check the id and the network.
        </Notice>
      </Screen>
    );
  }

  const v: VaultView = q.data;
  const p = v.vault.policy;
  const pending = v.proposals.filter((x) => x.status === Status.PENDING);

  return (
    <Screen
      top={
        <TopBar
          left={<Identicon address={v.vault.id} size={32} />}
          title={v.vault.name}
          right={<IconButton name="repeat" label="Switch vault" onPress={onSwitch} />}
        />
      }
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />
      }
    >
      <View style={{ gap: 20 }}>
        {v.vault.mode !== Mode.NORMAL ? <Tape /> : null}

        {v.vault.mode === Mode.LOCKDOWN ? (
          <Notice tone="bad">
            This vault is frozen. Nothing outgoing executes and no payment can be opened. Deposits
            still work. Reopening needs {p.governanceThreshold} owner
            {p.governanceThreshold === 1 ? '' : 's'}, {p.guardianThreshold} guardian
            {p.guardianThreshold === 1 ? '' : 's'} and {fmtDuration(p.policyChangeDelay)}.
          </Notice>
        ) : v.vault.mode === Mode.ELEVATED ? (
          <Notice tone="warn">
            Elevated. Every payment is escalated one tier and the caps are halved.
            {v.vault.postureReasons ? ` ${describeReasons(v.vault.postureReasons).join('; ')}.` : ''}
          </Notice>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}>
              <SectionLabel>Posture</SectionLabel>
              <ModeBadge mode={v.vault.mode} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <SectionLabel>Awaiting action</SectionLabel>
              <Text style={{ fontFamily: F.display, fontSize: 28, color: C.text }}>
                {pending.length}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>Holdings</SectionLabel>
          {v.assets.length === 0 ? (
            <Empty icon="inbox">No asset is approved for this vault yet.</Empty>
          ) : (
            <Card flush>
              {v.assets.map((a, i) => {
                const d = coinDecimals(a.coinType);
                const daily = a.limits.dailyMax;
                const spent = a.velocity?.daySpent ?? 0n;
                return (
                  <Row
                    key={a.coinType}
                    leading={<TokenMark coinType={a.coinType} />}
                    title={coinSymbol(a.coinType)}
                    subtitle={
                      daily === 0n
                        ? 'no daily cap'
                        : `${fmtAmount(spent, d)} of ${fmtAmount(daily, d)} used today`
                    }
                    trailing={
                      <Text style={{ fontFamily: F.monoMedium, fontSize: 15, color: C.text }}>
                        {fmtAmount(a.balance, d)}
                      </Text>
                    }
                    last={i === v.assets.length - 1}
                  />
                );
              })}
            </Card>
          )}
        </View>

        {pending.length > 0 ? (
          <Card flush>
            <Row
              leading={<Identicon address={v.vault.id} size={36} badge={String(pending.length)} />}
              title={`${pending.length} proposal${pending.length === 1 ? '' : 's'} open`}
              subtitle="Review what is waiting"
              onPress={onOpenQueue}
              chevron
              last
            />
          </Card>
        ) : null}

        <Card>
          <SectionLabel>What this vault enforces</SectionLabel>
          <KV k="Routine payment" v={`${p.approvalsLow} approval${p.approvalsLow === 1 ? '' : 's'}, no wait`} />
          <KV k="High risk" v={`${p.approvalsHigh} approvals, ${fmtDuration(p.delayHigh)}`} />
          <KV
            k="Critical"
            v={`${p.approvalsCritical} approvals${p.guardianRequiredCritical ? ` + ${p.guardianThreshold} guardian` : ''}, ${fmtDuration(p.delayCritical)}`}
          />
          <KV k="New recipient waits" v={fmtDuration(p.recipientActivationDelay)} />
          <KV
            k="Loss envelope"
            v={p.envelopeBps === 0 ? 'off' : `${p.envelopeBps / 100}% per ${fmtDuration(p.envelopeWindow)}`}
            last
          />
        </Card>

        <Card>
          <SectionLabel>This vault</SectionLabel>
          <Address value={v.vault.id} full />
        </Card>
      </View>
    </Screen>
  );
}
