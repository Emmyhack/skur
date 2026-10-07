import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { KIND_LABELS, Kind, Status, fmtAmount, fmtRelative, type Proposal } from '@skur/sdk';
import {
  Address,
  Card,
  Empty,
  ErrorState,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Skeleton,
  StatusBadge,
  Tabs,
  TierBadge,
  TopBar,
} from '../components/ui';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { Identicon } from '../components/Identicon';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

type Filter = 'all' | 'sent' | 'received';

/**
 * Screen 10 — the transaction list. "Sent" is every transfer that executed; "Received" is honest
 * about what the chain does: deposits land directly on the vault object, not through proposals,
 * so there is no per-deposit feed here — only where to send and what is accepted.
 */
export function Transactions({ onOpen }: { onOpen: (id: bigint) => void }) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);
  const [filter, setFilter] = useState<Filter>('all');

  const all = q.data?.proposals ?? [];
  const pending = all.filter((p) => p.status === Status.PENDING);
  const settled = all.filter((p) => p.status !== Status.PENDING);
  const sent = all.filter((p) => p.kind === Kind.TRANSFER && p.status === Status.EXECUTED);

  const line = (p: Proposal) =>
    p.kind === Kind.TRANSFER && p.asset
      ? fmtAmount(p.amount, coinDecimals(p.asset), coinSymbol(p.asset))
      : KIND_LABELS[p.kind];

  const item = (p: Proposal, i: number, arr: Proposal[]) => (
    <Row
      key={p.id.toString()}
      leading={
        p.kind === Kind.TRANSFER && p.asset ? <TokenMark coinType={p.asset} /> : <Identicon address={p.proposer} size={32} />
      }
      title={line(p)}
      subtitle={
        p.status === Status.PENDING ? (
          `${p.memo || KIND_LABELS[p.kind]} · ${p.approvals.length}/${p.reqApprovals} approvals`
        ) : (
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3 }}>
            {(p.memo ? `${p.memo} · ` : '') + fmtRelative(p.createdAt)}
          </Text>
        )
      }
      trailing={
        p.status === Status.PENDING && p.kind === Kind.TRANSFER ? <TierBadge tier={p.tier} /> : <StatusBadge status={p.status} />
      }
      onPress={() => onOpen(p.id)}
      chevron
      last={i === arr.length - 1}
    />
  );

  return (
    <Screen
      top={<TopBar title="Transactions" />}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />
      }
    >
      <View style={{ gap: 16 }}>
        <Tabs
          value={filter}
          options={[
            ['all', 'All'],
            ['sent', 'Sent'],
            ['received', 'Received'],
          ]}
          onChange={setFilter}
        />

        {q.isLoading ? <Skeleton lines={4} /> : null}
        {q.error ? <ErrorState onRetry={() => q.refetch()} /> : null}

        {filter === 'all' ? (
          <>
            <View style={{ gap: 8 }}>
              <SectionLabel>Awaiting action</SectionLabel>
              {pending.length === 0 ? (
                <Empty icon="check">Nothing is waiting.</Empty>
              ) : (
                <Card flush>{pending.map((p, i) => item(p, i, pending))}</Card>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <SectionLabel>Settled</SectionLabel>
              {settled.length === 0 ? (
                <Empty icon="clock">Nothing has settled yet.</Empty>
              ) : (
                <Card flush>{settled.map((p, i) => item(p, i, settled))}</Card>
              )}
            </View>
          </>
        ) : null}

        {filter === 'sent' ? (
          sent.length === 0 ? (
            <Empty icon="arrow-up-right">No payment has executed yet.</Empty>
          ) : (
            <Card flush>{sent.map((p, i) => item(p, i, sent))}</Card>
          )
        ) : null}

        {filter === 'received' ? (
          <View style={{ gap: 12 }}>
            <Notice tone="info">
              Deposits land directly on the vault — in any mode, from any address — so they do not
              appear as proposals. Share the address below to receive.
            </Notice>
            <Card>
              <SectionLabel>Vault address</SectionLabel>
              <Address value={vaultId ?? ''} full />
            </Card>
            {(q.data?.assets ?? []).filter((a) => a.limits.approved).length > 0 ? (
              <Card flush>
                {q.data!.assets
                  .filter((a) => a.limits.approved)
                  .map((a, i, arr) => (
                    <Row
                      key={a.coinType}
                      leading={<TokenMark coinType={a.coinType} />}
                      title={coinSymbol(a.coinType)}
                      subtitle={`holding ${fmtAmount(a.balance, coinDecimals(a.coinType))}`}
                      last={i === arr.length - 1}
                    />
                  ))}
              </Card>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
