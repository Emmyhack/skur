import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { fmtDate } from "@web/lib/format";
import { Status } from "@web/lib/types";
import type { ProposalView, VaultData } from "@web/lib/vaultReads";
import { describeProposal, statusText } from "../lib/describe";
import { Badge, Card, Empty, Notice, Screen, Segmented, StatusBadge, s } from "../components/ui";
import { C, F } from "../theme";

export function Transactions({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const items = vault.proposals.filter((p) => (tab === "queue" ? p.status === Status.PENDING : p.status !== Status.PENDING));
  return (
    <Screen title="Transactions" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}>
      <Segmented value={tab} options={[["queue", `Queue${vault.proposals.filter((p) => p.status === Status.PENDING).length ? ` · ${vault.proposals.filter((p) => p.status === Status.PENDING).length}` : ""}`], ["history", "History"]]} onChange={setTab} />
      {vault.logsFailed && <Notice tone="warn">The chain's event log could not be read, so purposes and history details are missing. Proposals below come straight from contract state.</Notice>}
      {vault.activityLoading ? <Empty>Reading proposals and history from the chain…</Empty> : items.length === 0 ? <Empty>{tab === "queue" ? "Proposals waiting for confirmation or execution will appear here" : "Executed, cancelled and vetoed proposals will appear here"}</Empty> : (
        <Card style={{ padding: 4 }}>
          {items.map((p, i) => <Row key={String(p.id)} p={p} vault={vault} last={i === items.length - 1} onPress={() => nav.navigate("TxDetail", { id: String(p.id) })} />)}
        </Card>
      )}
      <Text style={s.hint}>Governance proposals need owner confirmations. Security-reducing ones also wait out their timelock, and any guardian can veto them.</Text>
    </Screen>
  );
}

function Row({ p, vault, last, onPress }: { p: ProposalView; vault: VaultData; last: boolean; onPress: () => void }) {
  const d = describeProposal(p, vault);
  return (
    <Pressable onPress={onPress} style={[s.kv, { paddingHorizontal: 12, paddingVertical: 14 }, last && { borderBottomWidth: 0 }]}>
      <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.accent, fontFamily: F.bodyBold }}>{d.icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bodyBold, color: C.text, fontSize: 14 }}>{d.title} <Text style={{ fontFamily: F.mono, color: C.text3, fontSize: 11 }}>#{String(p.id)}</Text></Text>
        <Text style={{ fontFamily: F.body, color: C.text2, fontSize: 13 }} numberOfLines={1}>{d.detail}</Text>
        <Text style={{ fontFamily: F.body, color: C.text3, fontSize: 11, marginTop: 2 }}>{fmtDate(p.createdAt)}</Text>
      </View>
      {p.status === Status.PENDING ? <Badge tone="warn">{statusText(p)}</Badge> : <StatusBadge status={p.status} />}
    </Pressable>
  );
}
