import { RefreshControl, Text, View } from 'react-native';
import { Mode, describeReasons, fmtAmount, fmtDuration, type VaultView } from '@skur/sdk';
import {
  Address,
  Button,
  Card,
  Empty,
  ErrorState,
  IconButton,
  KV,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Skeleton,
  Tape,
  TopBar,
} from '../components/ui';
import { BarChart, Donut, PortfolioBar } from '../components/kit';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

/**
 * Screen 9 — the treasury overview: total balance, the portfolio breakdown, send/request, and
 * what the vault enforces. Shares are by normalised units, not price — this app carries no
 * oracle, and a breakdown that silently guessed at dollars would be a lie with a legend.
 */
export function Home({
  onOpenQueue,
  onSwitch,
  onSend,
  onRequest,
}: {
  onOpenQueue?: () => void;
  onSwitch: () => void;
  onSend?: () => void;
  onRequest?: () => void;
}) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);

  if (q.isLoading) {
    return (
      <Screen top={<TopBar title="Treasury" />}>
        <Skeleton lines={5} />
      </Screen>
    );
  }
  if (!q.data) {
    const message = q.error instanceof Error ? q.error.message : '';
    const badId = /not found|deleted|invalid|parse/i.test(message);
    return (
      <Screen top={<TopBar title="Treasury" right={<IconButton name="repeat" label="Switch vault" onPress={onSwitch} />} />}>
        <ErrorState
          title={badId ? 'That vault does not exist here' : 'Could not reach the vault'}
          detail={
            badId
              ? 'The id may be wrong, or it may live on a different network than this app points at.'
              : 'The vault itself is unaffected — this is a read, and reads can be retried freely.'
          }
          onRetry={() => q.refetch()}
        />
      </Screen>
    );
  }

  const v: VaultView = q.data;
  const p = v.vault.policy;

  const palette = [C.accent, C.info, C.success, C.warning, C.error];
  const normalized = v.assets.map((a, i) => ({
    label: coinSymbol(a.coinType),
    value: Number(a.balance) / 10 ** coinDecimals(a.coinType),
    color: palette[i % palette.length],
  }));
  const primary = [...v.assets].sort(
    (a, b) => Number(b.balance) / 10 ** coinDecimals(b.coinType) - Number(a.balance) / 10 ** coinDecimals(a.coinType),
  )[0];

  return (
    <Screen
      top={<TopBar title="Treasury" right={<IconButton name="repeat" label="Switch vault" onPress={onSwitch} />} />}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />
      }
    >
      <View style={{ gap: 16 }}>
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
          <SectionLabel>Total balance</SectionLabel>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Donut
              slices={normalized.length ? normalized : [{ label: '—', value: 1, color: C.card2 }]}
              centerTitle={primary ? fmtAmount(primary.balance, coinDecimals(primary.coinType)) : '0'}
              centerSub={primary ? `${coinSymbol(primary.coinType)} total` : 'no assets yet'}
            />
          </View>
          {normalized.length > 1 ? (
            <View style={{ marginTop: 10 }}>
              <PortfolioBar slices={normalized} />
            </View>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} icon="arrow-up-right" onPress={onSend}>
            Send
          </Button>
          <Button style={{ flex: 1 }} kind="secondary" icon="download" onPress={onRequest}>
            Request
          </Button>
        </View>

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

        {normalized.length > 0 ? (
          <Card>
            <SectionLabel>Asset breakdown</SectionLabel>
            <BarChart items={normalized.map((n) => ({ label: n.label, value: n.value }))} />
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

        {onOpenQueue ? (
          <Card flush>
            <Row title="Open proposals" subtitle="Review what is waiting" onPress={onOpenQueue} chevron last />
          </Card>
        ) : null}

        <Card>
          <SectionLabel>This vault</SectionLabel>
          <Address value={v.vault.id} full />
        </Card>
      </View>
    </Screen>
  );
}
