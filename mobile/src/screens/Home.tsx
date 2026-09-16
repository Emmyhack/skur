import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount } from "@web/lib/format";
import { Mode, ROLE_APPROVER, ROLE_OWNER, Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { needsMe } from "../hooks/useAlerts";
import { useMyRoles } from "../hooks/useVault";
import { scanBus } from "../lib/scanBus";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { VaultSheet } from "../components/VaultSheet";
import { Address, CircleIcon, Icon, IconButton, Row, Screen, Tape, TopBar, s } from "../components/ui";
import { C, F } from "../theme";

/** Home is the vault at a glance: what it holds, what is waiting, and the two things you do most. */
export function Home({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { labels, signer, setVaultAddress } = useStore();
  const roles = useMyRoles(vault);
  const [sheet, setSheet] = useState(false);
  const label = labels[vault.address.toLowerCase()] ?? "Treasury vault";
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING).length;
  const canPropose = Boolean(roles & (ROLE_OWNER | ROLE_APPROVER)) && vault.mode !== Mode.LOCKDOWN;
  const due = needsMe(vault, roles, signer?.address.toLowerCase() ?? null).length;
  const [whole, frac] = stable ? fmtAmount(stable.balance, stable.decimals, undefined, 2).split(".") : ["—", undefined];
  const scanVault = () => { scanBus.request((a) => void setVaultAddress(a as `0x${string}`)); nav.navigate("Scan"); };

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
            right={<><IconButton name="maximize" onPress={scanVault} /><IconButton name="bell" dot={due > 0} onPress={() => nav.navigate("Notifications")} /></>}
          />
          {vault.mode !== Mode.NORMAL && <Tape />}
        </>
      }>
      <View style={{ padding: 16, paddingTop: 10 }}>
        {pending > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Pending transactions" onPress={() => nav.navigate("Main", { screen: "Transactions" })} style={h.banner}>
            <View style={h.count}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.onAccent }}>{pending}</Text></View>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.accent, flex: 1 }}>Pending transactions</Text>
            <Icon name="chevron-right" size={18} color={C.accent} />
          </Pressable>
        )}
        {vault.mode !== Mode.NORMAL && (
          <Pressable accessibilityRole="button" accessibilityLabel="Security mode" onPress={() => nav.navigate("Security")} style={[h.banner, { backgroundColor: vault.mode === Mode.LOCKDOWN ? C.errorBg : C.warningBg }]}>
            <Icon name="alert-triangle" size={16} color={vault.mode === Mode.LOCKDOWN ? C.error : C.warning} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: vault.mode === Mode.LOCKDOWN ? C.error : C.warning, flex: 1 }}>{vault.mode === Mode.LOCKDOWN ? "Lockdown: outgoing payments are frozen" : "Elevated: every payment scored one tier higher"}</Text>
            <Icon name="chevron-right" size={18} color={vault.mode === Mode.LOCKDOWN ? C.error : C.warning} />
          </Pressable>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 11, color: C.onAccent }}>A</Text></View>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.text }}>Ark devnet</Text>
          <Address value={vault.address} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 10 }}>
          <Text style={h.balance}>{whole}</Text>
          {frac ? <Text style={[h.balance, { color: C.text3 }]}>.{frac}</Text> : null}
          <Text style={[h.balance, { fontSize: 20, color: C.text2, marginLeft: 8 }]}>{stable?.symbol}</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Action icon="arrow-up-right" label="Send" tone="accent" disabled={!canPropose} onPress={() => nav.navigate("Send")} />
          <Action icon="arrow-down-left" label="Receive" onPress={() => nav.navigate("Receive")} />
        </View>
      </View>

      <Text style={[s.sectionLabel, { paddingHorizontal: 16 }]}>Tokens</Text>
      {vault.assets.map((a, i) => (
        <Row key={a.address} leading={<CircleIcon size={40} tone={a.address === NATIVE_ASSET ? "accent" : "dark"} text={a.symbol.slice(0, 1)} />}
          title={a.symbol === "sUSD" ? "Skur Test USD" : a.symbol} subtitle={`${fmtAmount(vault.velocity[a.address]?.daySpent ?? 0n, a.decimals)} of ${a.limits.dailyMax ? fmtAmount(a.limits.dailyMax, a.decimals) : "∞"} today`}
          trailing={<Text style={s.rowTitle}>{fmtAmount(a.balance, a.decimals)}</Text>}
          onPress={canPropose ? () => nav.navigate("Send", { asset: a.address }) : undefined} last={i === vault.assets.length - 1} />
      ))}
      <VaultSheet open={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

function Action({ icon, label, onPress, tone = "dark", disabled }: { icon: "arrow-up-right" | "arrow-down-left"; label: string; onPress: () => void; tone?: "dark" | "accent"; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({ pressed }) => [h.action, tone === "accent" && { backgroundColor: C.accent }, { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      <Icon name={icon} size={16} color={tone === "accent" ? C.onAccent : C.text} />
      <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: tone === "accent" ? C.onAccent : C.text }}>{label}</Text>
    </Pressable>
  );
}

const h = {
  banner: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, backgroundColor: C.accentBg, borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 14 },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 6 },
  balance: { fontFamily: F.display, fontSize: 44, color: C.text, letterSpacing: -1.4 },
  action: { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.card, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
};
