import { useNavigation } from "@react-navigation/native";
import { Switch, Text, View } from "react-native";
import { fmtRelative, short } from "@web/lib/format";
import { Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { describeProposal } from "../lib/describe";
import { needsMe } from "../hooks/useAlerts";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { BackButton, Badge, Card, CircleIcon, Empty, Row, Screen, SectionLabel, TopBar, s } from "../components/ui";
import { C } from "../theme";

/** Safe's notification centre: what needs this signer, then what happened recently. */
export function NotificationsScreen({ vault }: { vault: VaultData }) {
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string, p?: object) => void }>();
  const { signer, notifications, setNotifications } = useStore();
  const roles = useMyRoles(vault);
  const due = needsMe(vault, roles, signer?.address.toLowerCase() ?? null);
  const recent = [...vault.proposals].sort((a, b) => Number(b.createdAt - a.createdAt)).slice(0, 12);
  return (
    <Screen padded={false} top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Updates</Text>} />}>
      <View style={{ padding: 16 }}>
        <Card flush>
          <Row leading={<CircleIcon name="bell" size={36} tone="accent" />} title="Notify me on this phone" subtitle="When a proposal newly needs your confirmation" trailing={<Switch value={notifications} onValueChange={(v) => void setNotifications(v)} trackColor={{ true: C.accent }} />} last />
        </Card>
        <SectionLabel>Needs you · {due.length}</SectionLabel>
        {due.length === 0 ? <Empty icon="check-circle">Nothing needs your signature right now.</Empty> : (
          <Card flush>
            {due.map((p, i) => { const d = describeProposal(p, vault); return <Row key={String(p.id)} leading={<CircleIcon name="info" size={40} tone="warn" />} title={`${d.title} requires your confirmation`} subtitle={`${d.detail} · ${fmtRelative(p.createdAt)}`} chevron onPress={() => nav.navigate("TxDetail", { id: String(p.id) })} last={i === due.length - 1} />; })}
          </Card>
        )}
        <SectionLabel>Recent activity</SectionLabel>
        {recent.length === 0 ? <Empty icon="clock">No proposals yet.</Empty> : (
          <Card flush>
            {recent.map((p, i) => { const d = describeProposal(p, vault); const tone = p.status === Status.EXECUTED ? "success" : p.status === Status.VETOED ? "error" : p.status === Status.PENDING ? "warn" : "dark"; return <Row key={String(p.id)} leading={<CircleIcon name={p.status === Status.EXECUTED ? "check" : p.status === Status.VETOED ? "x-octagon" : p.status === Status.PENDING ? "clock" : "minus"} size={40} tone={tone} />} title={`${d.title} · ${["", "pending", "executed", "cancelled", "vetoed"][p.status]}`} subtitle={`${d.detail} · by ${short(p.proposer)} · ${fmtRelative(p.createdAt)}`} trailing={p.status === Status.PENDING ? <Badge tone="warn">{p.liveApprovals}/{p.requiredApprovals}</Badge> : undefined} chevron onPress={() => nav.navigate("TxDetail", { id: String(p.id) })} last={i === recent.length - 1} />; })}
          </Card>
        )}
        <Text style={s.hint}>Notifications are raised on this phone when the app reads the vault and finds a proposal that newly needs you. There is no server between you and the chain.</Text>
      </View>
    </Screen>
  );
}
