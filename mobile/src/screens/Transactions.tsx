import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { fmtDate } from "@web/lib/format";
import { Kind, Status } from "@web/lib/types";
import type { ProposalView, VaultData } from "@web/lib/vaultReads";
import { describeProposal, statusText } from "../lib/describe";
import { Badge, Card, CircleIcon, Empty, IconButton, Notice, Row, Screen, StatusBadge, Tabs, TopBar, type IconName, s } from "../components/ui";
import { C } from "../theme";

export const KIND_ICON: Record<number, IconName> = { [Kind.TRANSFER]: "arrow-up-right", [Kind.POLICY_UPDATE]: "sliders", [Kind.ASSET_LIMITS]: "sliders", [Kind.MEMBER_SET]: "users", [Kind.RECIPIENT_TRUST]: "book", [Kind.MODE_RELAX]: "shield", [Kind.RECOVERY]: "life-buoy" };

export function Transactions({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const pendingCount = vault.proposals.filter((p) => p.status === Status.PENDING).length;
  const items = vault.proposals.filter((p) => (tab === "queue" ? p.status === Status.PENDING : p.status !== Status.PENDING));
  const groups = new Map<string, ProposalView[]>();
  for (const p of items) { const d = fmtDate(p.createdAt).split(" at ")[0]; groups.set(d, [...(groups.get(d) ?? []), p]); }
  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}
      top={<TopBar title="Transactions" right={<IconButton name="plus" tone="accent" onPress={() => nav.navigate("Send")} />} />}>
      <View style={{ paddingHorizontal: 16 }}>
        <Tabs value={tab} options={[["queue", pendingCount ? `Queue · ${pendingCount}` : "Queue"], ["history", "History"]]} onChange={setTab} />
        {vault.logsFailed && <Notice tone="warn">The chain's event log could not be read, so purposes and history details are missing.</Notice>}
      </View>
      {vault.activityLoading ? <Empty icon="loader">Reading proposals and history from the chain…</Empty> : items.length === 0 ? (
        <Empty icon={tab === "queue" ? "inbox" : "clock"}>{tab === "queue" ? "Proposals waiting for confirmation or execution will appear here" : "Executed, cancelled and vetoed proposals will appear here"}</Empty>
      ) : [...groups.entries()].map(([date, ps]) => (
        <View key={date} style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <Text style={s.sectionLabel}>{date}</Text>
          <Card flush>
            {ps.map((p, i) => {
              const d = describeProposal(p, vault);
              return <Row key={String(p.id)} leading={<CircleIcon name={KIND_ICON[p.kind] ?? "file-text"} size={40} tone={p.status === Status.VETOED ? "error" : p.status === Status.EXECUTED ? "success" : "dark"} />} title={d.title} subtitle={d.detail} onPress={() => nav.navigate("TxDetail", { id: String(p.id) })} chevron last={i === ps.length - 1}
                trailing={p.status === Status.PENDING ? <Badge tone="warn" icon="users">{statusText(p)}</Badge> : <StatusBadge status={p.status} />} />;
            })}
          </Card>
        </View>
      ))}
      <Text style={[s.hint, { paddingHorizontal: 16, marginTop: 12 }]}>Governance proposals need owner confirmations. Security-reducing ones also wait out their timelock, and any guardian can veto them.</Text>
    </Screen>
  );
}
