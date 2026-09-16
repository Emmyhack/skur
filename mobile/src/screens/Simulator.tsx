import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../state/theme";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, parseAmount } from "@web/lib/format";
import { runScenarios, type Verdict } from "@web/lib/simulator";
import { TEMPLATES, type TemplateId } from "@web/lib/templates";
import type { Policy } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { BackButton, Badge, Card, CircleIcon, Field, Input, Row, Screen, SectionLabel, TopBar, useStyles } from "../components/ui";
import { F } from "../theme";

const TONE: Record<Verdict, "ok" | "warn" | "bad" | "info"> = { blocked: "ok", impossible: "ok", delayed: "info", escalated: "warn", allowed: "bad" };
const TEXT: Record<Verdict, string> = { blocked: "Blocked", impossible: "Not possible", delayed: "Delayed", escalated: "Escalated", allowed: "Would succeed" };

/** Runs the policy against the attacks that actually happen, with the contract's own rules. */
export function Simulator({ vault }: { vault: VaultData | undefined }) {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ goBack: () => void }>();
  const [source, setSource] = useState<"vault" | TemplateId>(vault ? "vault" : "startup");
  const [balanceText, setBalanceText] = useState("1,000,000");
  const [approvers, setApprovers] = useState("3");
  const [guardians, setGuardians] = useState("1");
  const stable = vault?.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault?.assets[0];
  const decimals = stable?.decimals ?? 6;
  const symbol = stable?.symbol ?? "USD";
  const { policy, limits } = useMemo(() => {
    if (source === "vault" && vault && stable) return { policy: vault.policy as Policy, limits: stable.limits };
    const t = TEMPLATES.find((x) => x.id === source) ?? TEMPLATES[0];
    return { policy: t.policy, limits: t.stable };
  }, [source, vault, stable]);
  const balance = source === "vault" && stable ? stable.balance : (parseAmount(balanceText, decimals) ?? 0n);
  const approverCount = source === "vault" && vault ? vault.counts.approvers : Number(approvers) || 0;
  const guardianCount = source === "vault" && vault ? vault.counts.guardians : Number(guardians) || 0;
  const results = useMemo(() => runScenarios({ policy, limits, balance, decimals, symbol, approverCount, guardianCount }), [policy, limits, balance, decimals, symbol, approverCount, guardianCount]);
  const stopped = results.filter((r) => r.verdict !== "allowed").length;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen padded={false} top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Simulator</Text>} right={<Badge tone={stopped === results.length ? "ok" : "bad"}>{stopped}/{results.length} stopped</Badge>} />}>
      <View style={{ padding: 16 }}>
        <SectionLabel>Configuration under test</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {vault && <Chip on={source === "vault"} onPress={() => setSource("vault")}>Live vault v{vault.policyVersion}</Chip>}
          {TEMPLATES.map((t) => <Chip key={t.id} on={source === t.id} onPress={() => setSource(t.id)}>{t.name}</Chip>)}
        </View>
        {source === "vault" && stable ? <Text style={[s.hint, { marginBottom: 12 }]}>Treasury {fmtAmount(stable.balance, stable.decimals, stable.symbol)} · {approverCount} approvers · {guardianCount} guardians</Text> : (
          <Card>
            <Field label={`Treasury balance (${symbol})`}><Input value={balanceText} onChangeText={setBalanceText} keyboardType="decimal-pad" /></Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Approvers"><Input value={approvers} onChangeText={setApprovers} keyboardType="number-pad" /></Field></View>
              <View style={{ flex: 1 }}><Field label="Guardians"><Input value={guardians} onChangeText={setGuardians} keyboardType="number-pad" /></Field></View>
            </View>
          </Card>
        )}
        <SectionLabel>Scenarios</SectionLabel>
        <Card flush>
          {results.map((r, i) => (
            <View key={r.id}>
              <Row leading={<CircleIcon name={r.verdict === "allowed" ? "alert-octagon" : r.verdict === "delayed" ? "clock" : r.verdict === "escalated" ? "trending-up" : "shield"} size={40} tone={r.verdict === "allowed" ? "error" : r.verdict === "delayed" ? "dark" : r.verdict === "escalated" ? "warn" : "success"} />} title={r.title} subtitle={r.narrative} trailing={<Badge tone={TONE[r.verdict]}>{TEXT[r.verdict]}</Badge>} chevron onPress={() => setOpen(open === r.id ? null : r.id)} last={i === results.length - 1 && open !== r.id} />
              {open === r.id && <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: i === results.length - 1 ? 0 : 0.5, borderBottomColor: C.border }}>{r.detail.map((d) => <Text key={d} style={{ fontFamily: F.body, color: C.text, fontSize: 13, lineHeight: 20 }}>▪ {d}</Text>)}</View>}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) {
  const C = useTheme();
  return <Pressable onPress={onPress} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: on ? C.accent : C.card2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: on ? C.onAccent : C.text }}>{children}</Text></Pressable>;
}
