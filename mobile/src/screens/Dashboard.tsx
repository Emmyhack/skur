import { RefreshControl, Text, View } from 'react-native';
import { KIND_LABELS, Kind, Mode, Status, fmtAmount, fmtRelative, type Proposal } from '@skur/sdk';
import {
  Card,
  Empty,
  ErrorState,
  IconButton,
  ModeBadge,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Skeleton,
  StatusBadge,
  Tape,
  TierBadge,
  TopBar,
} from '../components/ui';
import { Stat } from '../components/kit';
import { Identicon } from '../components/Identicon';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

/**
 * Screen 8 — the dashboard. The treasury's value, what is waiting, who is on it, and what just
 * happened. No fiat figures: this app has no price oracle, and a made-up dollar number on a
 * treasury screen is worse than none.
 */
export function Dashboard({
  onOpenProposals,
  onOpenProposal,
  onOpenTreasury,
  onSwitch,
}: {
  onOpenProposals: () => void;
  onOpenProposal: (id: bigint) => void;
  onOpenTreasury: () => void;
  onSwitch: () => void;
}) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);

  if (q.isLoading) {
    return (
      <Screen top={<TopBar title="Home" />}>
        <Skeleton lines={5} />
      </Screen>
    );
  }
  if (!q.data) {
    const message = q.error instanceof Error ? q.error.message : '';
    const badId = /not found|deleted|invalid|parse/i.test(message);
    return (
      <Screen top={<TopBar title="Home" right={<IconButton name="repeat" label="Switch vault" onPress={onSwitch} />} />}>
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

  const v = q.data;
  const pending = v.proposals.filter((x) => x.status === Status.PENDING);
  const recent = [...v.proposals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const primary = [...v.assets].sort((a, b) =>
    Number(b.balance / 10n ** BigInt(coinDecimals(b.coinType))) - Number(a.balance / 10n ** BigInt(coinDecimals(a.coinType))),
  )[0];

  const line = (p: Proposal) =>
    p.kind === Kind.TRANSFER && p.asset
      ? fmtAmount(p.amount, coinDecimals(p.asset), coinSymbol(p.asset))
      : KIND_LABELS[p.kind];

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
      <View style={{ gap: 16 }}>
        {v.vault.mode !== Mode.NORMAL ? <Tape /> : null}
        {v.vault.mode === Mode.LOCKDOWN ? (
          <Notice tone="bad">This vault is frozen. Nothing outgoing executes. Deposits still work.</Notice>
        ) : v.vault.mode === Mode.ELEVATED ? (
          <Notice tone="warn">Elevated: every payment is escalated one tier and the caps are halved.</Notice>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <SectionLabel>Total treasury value</SectionLabel>
            <ModeBadge mode={v.vault.mode} />
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 36, color: C.text, letterSpacing: -0.5 }}>
            {primary ? fmtAmount(primary.balance, coinDecimals(primary.coinType)) : '0'}
            <Text style={{ fontSize: 20, color: C.text2 }}>
              {' '}
              {primary ? coinSymbol(primary.coinType) : ''}
            </Text>
          </Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3, marginTop: 2 }}>
            {v.assets.length === 1
              ? 'one asset approved'
              : `across ${v.assets.length} assets — see Treasury for the breakdown`}
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {v.assets.slice(0, 2).map((a) => (
            <Stat
              key={a.coinType}
              value={fmtAmount(a.balance, coinDecimals(a.coinType))}
              label={coinSymbol(a.coinType)}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat value={String(pending.length)} label="Pending approvals" tone={pending.length ? 'accent' : 'plain'} />
          <Stat value={String(v.members.length)} label="Active members" />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel>Recent activity</SectionLabel>
            <Text onPress={onOpenProposals} style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.text2 }}>
              View all
            </Text>
          </View>
          {recent.length === 0 ? (
            <Empty icon="inbox">Nothing has happened yet. Fund the vault, or open the first payment.</Empty>
          ) : (
            <Card flush>
              {recent.map((p, i) => (
                <Row
                  key={p.id.toString()}
                  leading={
                    p.kind === Kind.TRANSFER && p.asset ? (
                      <TokenMark coinType={p.asset} />
                    ) : (
                      <Identicon address={p.proposer} size={32} />
                    )
                  }
                  title={line(p)}
                  subtitle={`${p.memo || KIND_LABELS[p.kind]} · ${fmtRelative(p.createdAt)}`}
                  trailing={
                    p.status === Status.PENDING && p.kind === Kind.TRANSFER ? (
                      <TierBadge tier={p.tier} />
                    ) : (
                      <StatusBadge status={p.status} />
                    )
                  }
                  onPress={() => onOpenProposal(p.id)}
                  chevron
                  last={i === recent.length - 1}
                />
              ))}
            </Card>
          )}
        </View>

        <Card flush>
          <Row
            leading={<Identicon address={v.vault.id} size={36} />}
            title="Treasury"
            subtitle="Balances, breakdown, send and request"
            onPress={onOpenTreasury}
            chevron
            last
          />
        </Card>
      </View>
    </Screen>
  );
}
