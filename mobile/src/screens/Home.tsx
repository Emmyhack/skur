import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, fmtDuration, short } from "@web/lib/format";
import { Mode, ROLE_APPROVER, ROLE_OWNER, roleNames, Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { needsMe } from "../hooks/useAlerts";
import { scanBus } from "../lib/scanBus";
import { VaultSheet } from "../components/VaultSheet";
import { Address, Badge, Card, CircleIcon, Icon, IconButton, KV, Row, Screen, Tabs, Tape, TopBar, s } from "../components/ui";
import { C, F } from "../theme";

export function Home({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { labels, signer } = useStore();
  const roles = useMyRoles(vault);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<"tokens" | "policy" | "members">("tokens");
  const label = labels[vault.address.toLowerCase()] ?? "Treasury vault";
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING).length;
  const canPropose = Boolean(roles & (ROLE_OWNER | ROLE_APPROVER)) && vault.mode !== Mode.LOCKDOWN;
  const due = needsMe(vault, roles, signer?.address.toLowerCase() ?? null).length;
  const { setVaultAddress } = useStore();
  const scanVault = () => { scanBus.request((a) => void setVaultAddress(a as `0x${string}`)); nav.navigate("Scan"); };
  const [whole, frac] = stable ? fmtAmount(stable.balance, stable.decimals, undefined, 2).split(".") : ["—", undefined];

  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}
      top={
        <>
          <TopBar
            left={
              <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setSheet(true)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Identicon address={vault.address} size={36} badge={`${vault.policy.approvalsLow}/${vault.counts.approvers}`} />
                <Text style={{ fontFamily: F.bodyBold, fontSize: 17, color: C.text }} numberOfLines={1}>{label}</Text>
                <Icon name="chevron-down" size={16} color={C.text2} />
              </Pressable>
            }
            right={<><IconButton name="maximize" onPress={scanVault} /><IconButton name="bell" dot={due > 0 || vault.mode !== Mode.NORMAL} onPress={() => nav.navigate("Notifications")} /></>}
          />
          {vault.mode !== Mode.NORMAL && <Tape />}
        </>
      }>
      <View style={{ padding: 16, paddingTop: 8 }}>
        {pending > 0 && (
          <Pressable onPress={() => nav.navigate("Main", { screen: "Transactions" })} style={h.pending}>
            <View style={h.count}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.onAccent }}>{pending}</Text></View>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.accent, flex: 1 }}>Pending transactions</Text>
            <Icon name="chevron-right" size={18} color={C.accent} />
          </Pressable>
        )}
        {vault.mode !== Mode.NORMAL && (
          <Pressable onPress={() => nav.navigate("Security")} style={[h.pending, { backgroundColor: vault.mode === Mode.LOCKDOWN ? C.errorBg : C.warningBg }]}>
            <Icon name="alert-triangle" size={16} color={vault.mode === Mode.LOCKDOWN ? C.error : C.warning} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: vault.mode === Mode.LOCKDOWN ? C.error : C.warning, flex: 1 }}>{vault.mode === Mode.LOCKDOWN ? "Lockdown: outgoing payments are frozen" : "Elevated: every payment scored one tier higher"}</Text>
            <Icon name="chevron-right" size={18} color={vault.mode === Mode.LOCKDOWN ? C.error : C.warning} />
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 11, color: C.onAccent }}>A</Text></View>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.text }}>Ark devnet</Text>
          <Address value={vault.address} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 8 }}>
          <Text style={h.balance}>{whole}</Text>
          {frac ? <Text style={[h.balance, { color: C.text3 }]}>.{frac}</Text> : null}
          <Text style={[h.balance, { fontSize: 20, color: C.text2, marginLeft: 8 }]}>{stable?.symbol}</Text>
        </View>
        <Text style={s.rowSub}>policy v{vault.policyVersion} · {vault.members.length} members · {roleNames(roles).join(", ") || (signer ? "not a member" : "read-only")}</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <Action icon="arrow-up-right" label="Send" tone="accent" disabled={!canPropose} onPress={() => nav.navigate("Send")} />
          <Action icon="arrow-down-left" label="Receive" onPress={() => nav.navigate("Receive")} />
          <Action icon="shield" label="Security" onPress={() => nav.navigate("Security")} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Tabs value={tab} options={[["tokens", "Tokens"], ["policy", "Policy"], ["members", "Members"]]} onChange={setTab} />
      </View>
      {tab === "tokens" && vault.assets.map((a, i) => (
        <Row key={a.address} leading={<CircleIcon size={40} tone={a.address === NATIVE_ASSET ? "accent" : "dark"} text={a.symbol.slice(0, 1)} />} title={a.symbol === "sUSD" ? "Skur Test USD" : a.symbol} subtitle={`${fmtAmount(a.balance, a.decimals)} ${a.symbol}`} onPress={canPropose ? () => nav.navigate("Send", { asset: a.address }) : undefined} last={i === vault.assets.length - 1}
          trailing={<View style={{ alignItems: "flex-end" }}><Text style={s.rowTitle}>{fmtAmount(a.balance, a.decimals)}</Text><Text style={s.rowSub}>{fmtAmount(vault.velocity[a.address]?.daySpent ?? 0n, a.decimals)} of {a.limits.dailyMax ? fmtAmount(a.limits.dailyMax, a.decimals) : "∞"} today</Text></View>} />
      ))}
      {tab === "policy" && (
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable onPress={() => nav.navigate("Policy")} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}><Icon name="sliders" size={16} color={C.accent} /><Text style={{ fontFamily: F.bodyBold, color: C.accent }}>Edit policy · v{vault.policyVersion}</Text></Pressable>
          <KV k="Approvals" v={`Low ${vault.policy.approvalsLow} · High ${vault.policy.approvalsHigh} · Critical ${vault.policy.approvalsCritical}${vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""}`} />
          <KV k="Delays" v={`High ${fmtDuration(vault.policy.delayHigh)} · Critical ${fmtDuration(vault.policy.delayCritical)}`} />
          <KV k="New recipients wait" v={fmtDuration(vault.policy.recipientActivationDelay)} />
          <KV k="Security-reducing changes wait" v={fmtDuration(vault.policy.policyChangeDelay)} />
          <KV k="Circuit breaker" v={vault.policy.envelopeBps ? `${vault.policy.envelopeBps / 100}% per ${fmtDuration(vault.policy.envelopeWindow)}` : "off"} />
          {stable && <KV k={`${stable.symbol} limits`} v={`routine ≤ ${fmtAmount(stable.limits.lowMax, stable.decimals)} · per tx ≤ ${stable.limits.perTxMax ? fmtAmount(stable.limits.perTxMax, stable.decimals) : "∞"} · daily ≤ ${stable.limits.dailyMax ? fmtAmount(stable.limits.dailyMax, stable.decimals) : "∞"}`} last />}
        </View>
      )}
      {tab === "members" && vault.members.map((m, i) => (
        <Row key={m.address} leading={<Identicon address={m.address} size={36} />} title={short(m.address, 6)} subtitle={m.address.toLowerCase() === signer?.address.toLowerCase() ? "this phone" : undefined} onPress={() => nav.navigate("Members")} chevron last={i === vault.members.length - 1}
          trailing={<View style={{ flexDirection: "row", gap: 4 }}>{roleNames(m.roles).map((r) => <Badge key={r} tone={r === "Guardian" ? "accent" : "neutral"}>{r}</Badge>)}</View>} />
      ))}
      <VaultSheet open={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

function Action({ icon, label, onPress, tone = "dark", disabled }: { icon: "arrow-up-right" | "arrow-down-left" | "shield"; label: string; onPress: () => void; tone?: "dark" | "accent"; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [h.action, tone === "accent" && { backgroundColor: C.accent }, { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      <Icon name={icon} size={16} color={tone === "accent" ? C.onAccent : C.text} />
      <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: tone === "accent" ? C.onAccent : C.text }}>{label}</Text>
    </Pressable>
  );
}

const h = {
  pending: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, backgroundColor: C.accentBg, borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 12 },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 6 },
  balance: { fontFamily: F.display, fontSize: 40, color: C.text, letterSpacing: -1.2 },
  action: { flex: 1, height: 44, borderRadius: 12, backgroundColor: C.card, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6 },
};
