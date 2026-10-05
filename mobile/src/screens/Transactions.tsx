import { RefreshControl, Text, View } from 'react-native';
import { KIND_LABELS, Kind, Status, fmtAmount, fmtRelative, type Proposal } from '@skur/sdk';
import {
  Card,
  Empty,
  Notice,
  Row,
  Screen,
  SectionLabel,
  StatusBadge,
  TierBadge,
  TopBar,
} from '../components/ui';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { Identicon } from '../components/Identicon';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

export function Transactions({ onOpen }: { onOpen: (id: bigint) => void }) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);

  const pending = (q.data?.proposals ?? []).filter((p) => p.status === Status.PENDING);
  const settled = (q.data?.proposals ?? []).filter((p) => p.status !== Status.PENDING);

  const line = (p: Proposal) => {
    if (p.kind === Kind.TRANSFER && p.asset) {
      return `${fmtAmount(p.amount, coinDecimals(p.asset), coinSymbol(p.asset))}`;
    }
    return KIND_LABELS[p.kind];
  };

  return (
    <Screen
      top={<TopBar title="Activity" />}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />
      }
    >
      <View style={{ gap: 20 }}>
        {q.error ? <Notice tone="bad">Could not read the vault.</Notice> : null}

        <View style={{ gap: 8 }}>
          <SectionLabel>Awaiting action</SectionLabel>
          {pending.length === 0 ? (
            <Empty icon="check">Nothing is waiting.</Empty>
          ) : (
            <Card flush>
              {pending.map((p, i) => (
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
                  subtitle={`${p.memo || KIND_LABELS[p.kind]} · ${p.approvals.length}/${p.reqApprovals} approvals`}
                  trailing={p.kind === Kind.TRANSFER ? <TierBadge tier={p.tier} /> : <StatusBadge status={p.status} />}
                  onPress={() => onOpen(p.id)}
                  chevron
                  last={i === pending.length - 1}
                />
              ))}
            </Card>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>Settled</SectionLabel>
          {settled.length === 0 ? (
            <Empty icon="clock">Nothing has settled yet.</Empty>
          ) : (
            <Card flush>
              {settled.map((p, i) => (
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
                  subtitle={
                    <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3 }}>
                      {fmtRelative(p.createdAt)}
                    </Text>
                  }
                  trailing={<StatusBadge status={p.status} />}
                  onPress={() => onOpen(p.id)}
                  chevron
                  last={i === settled.length - 1}
                />
              ))}
            </Card>
          )}
        </View>
      </View>
    </Screen>
  );
}
