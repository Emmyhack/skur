import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KIND_LABELS, Kind, Status, fmtAmount, fmtRelative, short, type Proposal } from '@skur/sdk';
import {
  BackButton,
  Card,
  CircleIcon,
  Empty,
  ErrorState,
  Row,
  Screen,
  Skeleton,
  Tabs,
  TopBar,
  type IconName,
} from '../components/ui';
import { coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

type Filter = 'all' | 'approvals' | 'system';
type Entry = { key: string; icon: IconName; tone: 'ok' | 'warn' | 'bad' | 'info' | 'dark'; title: string; sub: string; at: number; kind: Filter };

/**
 * Screen 19 — the audit trail, derived from the proposals the chain records. Approvals are listed
 * by signer; "system" is everything that changes the vault itself rather than moving money.
 */
export function ActivityLog({ onBack }: { onBack: () => void }) {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);
  const [filter, setFilter] = useState<Filter>('all');

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const system = new Set<Kind>([Kind.POLICY_UPDATE, Kind.MEMBER_SET, Kind.ASSET_LIMITS, Kind.MODE_RELAX, Kind.RECOVERY, Kind.RECIPIENT_TRUST]);
    for (const p of (q.data?.proposals ?? []) as Proposal[]) {
      const isSystem = system.has(p.kind);
      const what =
        p.kind === Kind.TRANSFER && p.asset
          ? `${fmtAmount(p.amount, coinDecimals(p.asset), coinSymbol(p.asset))}`
          : KIND_LABELS[p.kind];
      out.push({
        key: `${p.id}-open`,
        icon: isSystem ? 'settings' : 'arrow-up-right',
        tone: 'info',
        title: `${KIND_LABELS[p.kind]} opened`,
        sub: `#${p.id} · ${what} · by ${short(p.proposer)} · ${fmtRelative(p.createdAt)}`,
        at: p.createdAt,
        kind: isSystem ? 'system' : 'all',
      });
      for (const a of p.approvals) {
        out.push({
          key: `${p.id}-ap-${a}`,
          icon: 'check',
          tone: 'ok',
          title: `Approved by ${short(a)}`,
          sub: `#${p.id} · ${what}`,
          at: p.createdAt + 1,
          kind: 'approvals',
        });
      }
      for (const r of p.rejections) {
        out.push({
          key: `${p.id}-rj-${r}`,
          icon: 'x',
          tone: 'warn',
          title: `Rejected by ${short(r)}`,
          sub: `#${p.id} · ${what}`,
          at: p.createdAt + 1,
          kind: 'approvals',
        });
      }
      for (const g of p.confirmations) {
        out.push({
          key: `${p.id}-cf-${g}`,
          icon: 'shield',
          tone: 'info',
          title: `Guardian confirmed · ${short(g)}`,
          sub: `#${p.id} · ${what}`,
          at: p.createdAt + 1,
          kind: 'approvals',
        });
      }
      if (p.status !== Status.PENDING) {
        out.push({
          key: `${p.id}-end`,
          icon: p.status === Status.EXECUTED ? 'check-circle' : p.status === Status.VETOED ? 'slash' : 'x-circle',
          tone: p.status === Status.EXECUTED ? 'ok' : p.status === Status.VETOED ? 'bad' : 'warn',
          title:
            p.status === Status.EXECUTED
              ? `${KIND_LABELS[p.kind]} executed`
              : p.status === Status.VETOED
                ? `${KIND_LABELS[p.kind]} vetoed`
                : `${KIND_LABELS[p.kind]} closed`,
          sub: `#${p.id} · ${what}`,
          at: p.createdAt + 2,
          kind: isSystem ? 'system' : 'all',
        });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  }, [q.data]);

  const visible = entries.filter((e) => filter === 'all' || e.kind === filter);

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Activity Logs" />}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />}
    >
      <View style={{ gap: 16 }}>
        <Tabs
          value={filter}
          options={[
            ['all', 'All'],
            ['approvals', 'Approvals'],
            ['system', 'System'],
          ]}
          onChange={setFilter}
        />
        {q.isLoading ? <Skeleton lines={5} /> : null}
        {q.error ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && visible.length === 0 ? (
          <Empty icon="file-text">Nothing in this view yet.</Empty>
        ) : (
          <Card flush>
            {visible.map((e, i) => (
              <Row
                key={e.key}
                leading={<CircleIcon name={e.icon} size={34} tone={e.tone} />}
                title={e.title}
                subtitle={e.sub}
                last={i === visible.length - 1}
              />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
