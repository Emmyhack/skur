import { useNavigation } from "@react-navigation/native";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, fmtDuration, short } from "@web/lib/format";
import { Mode, ROLE_APPROVER, ROLE_OWNER, Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { describeProposal, statusText } from "../lib/describe";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { Address, Badge, Button, Card, Empty, KV, ModeBadge, Screen, Tape, s } from "../components/ui";
import { C, F } from "../theme";

export function Home({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { labels, signer } = useStore();
  const roles = useMyRoles(vault);
  const label = labels[vault.address.toLowerCase()] ?? "Treasury vault";
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const native = vault.assets.find((a) => a.address === NATIVE_ASSET);
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING);
  const canPropose = Boolean(roles & (ROLE_OWNER | ROLE_APPROVER)) && vault.mode !== Mode.LOCKDOWN;

  return (
    <Screen title={label} sub={short(vault.address, 6)} right={<ModeBadge mode={vault.mode} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}>
      {vault.mode !== Mode.NORMAL && <Tape running={vault.mode === Mode.LOCKDOWN} />}
      <Card style={vault.mode !== Mode.NORMAL ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        <Text style={s.kvK}>Total balance</Text>
        <Text style={{ fontFamily: F.display, fontSize: 34, color: C.text, letterSpacing: -1, marginVertical: 4 }}>{stable ? fmtAmount(stable.balance, stable.decimals, stable.symbol) : "—"}</Text>
        <Text style={s.hint}>{native ? `+ ${fmtAmount(native.balance, native.decimals, native.symbol)}` : ""} · policy v{vault.policyVersion} · {vault.members.length} members</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <Button style={{ flex: 1 }} disabled={!canPropose} onPress={() => nav.navigate("Send")}>Send</Button>
          <Button style={{ flex: 1 }} kind="secondary" onPress={() => nav.navigate("Receive")}>Receive</Button>
        </View>
        {!signer && <Text style={[s.hint, { marginTop: 10 }]}>Read-only: add a signer key under Settings to confirm or propose.</Text>}
        {signer && roles === 0 && <Text style={[s.hint, { marginTop: 10 }]}>Read-only: {short(signer.address)} is not a member of this vault.</Text>}
      </Card>

      {vault.mode !== Mode.NORMAL && (
        <Card>
          <Badge tone={vault.mode === Mode.LOCKDOWN ? "bad" : "warn"}>{vault.mode === Mode.LOCKDOWN ? "LOCKDOWN" : "ELEVATED"}</Badge>
          <Text style={[s.cardTitle, { marginTop: 8 }]}>{vault.mode === Mode.LOCKDOWN ? "Outgoing payments are frozen" : "Every payment is scored one tier higher"}</Text>
          <Text style={[s.sub, { marginTop: 4 }]}>{vault.mode === Mode.LOCKDOWN ? "Deposits, tightening changes, recovery and guardian actions still work." : "Per-transaction and daily caps are halved until owners and guardians lower the mode."}</Text>
        </Card>
      )}

      <Card title="Pending transactions" action={pending.length > 0 ? <Pressable onPress={() => nav.navigate("Transactions")}><Text style={{ color: C.accent, fontFamily: F.bodyBold }}>View all ›</Text></Pressable> : undefined}>
        {vault.activityLoading ? <Empty>Reading the queue from the chain…</Empty> : pending.length === 0 ? <Empty>Nothing waiting for a signature</Empty> : pending.slice(0, 4).map((p) => {
          const d = describeProposal(p, vault);
          return (
            <Pressable key={String(p.id)} onPress={() => nav.navigate("TxDetail", { id: String(p.id) })} style={s.kv}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bodyMedium, color: C.text, fontSize: 14 }}>{d.title} · {d.detail}</Text></View>
              <Badge tone="warn">{statusText(p)}</Badge>
            </Pressable>
          );
        })}
      </Card>

      <Card title="Assets">
        {vault.assets.map((a, i) => (
          <KV key={a.address} k={a.symbol} v={`${fmtAmount(a.balance, a.decimals)} · ${fmtAmount(vault.velocity[a.address]?.daySpent ?? 0n, a.decimals)} of ${a.limits.dailyMax ? fmtAmount(a.limits.dailyMax, a.decimals) : "∞"} today`} last={i === vault.assets.length - 1} />
        ))}
      </Card>

      <Card title="Policy at a glance" action={<Pressable onPress={() => nav.navigate("Security")}><Text style={{ color: C.accent, fontFamily: F.bodyBold }}>Security ›</Text></Pressable>}>
        <KV k="Approvals" v={`Low ${vault.policy.approvalsLow} · High ${vault.policy.approvalsHigh} · Critical ${vault.policy.approvalsCritical}${vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""}`} />
        <KV k="Delays" v={`High ${fmtDuration(vault.policy.delayHigh)} · Critical ${fmtDuration(vault.policy.delayCritical)}`} />
        <KV k="New recipients wait" v={fmtDuration(vault.policy.recipientActivationDelay)} />
        <KV k="Circuit breaker" v={vault.policy.envelopeBps ? `${vault.policy.envelopeBps / 100}% per ${fmtDuration(vault.policy.envelopeWindow)}` : "off"} last />
      </Card>
      <Text style={[s.hint, { textAlign: "center" }]}>Vault <Address value={vault.address} full /></Text>
    </Screen>
  );
}
