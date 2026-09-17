import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../state/theme";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { fmtAmount, fmtDate, fmtDuration, fmtRelative, nowSec, short } from "@web/lib/format";
import { ROLE_APPROVER, ROLE_OWNER, Trust, TRUST_LABEL } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { scanBus } from "../lib/scanBus";
import { Identicon } from "../components/Identicon";
import { Address, BackButton, Badge, Button, Card, Empty, Field, IconButton, Input, Notice, Row, Screen, Sheet, TopBar, TrustBadge, TxStatus, useStyles } from "../components/ui";
import { F } from "../theme";

/** Recipients are security objects: register early, verify, restrict or block. */
export function AddressBook({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string) => void }>();
  const roles = useMyRoles(vault);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [dialog, setDialog] = useState<"register" | "trust" | null>(null);
  const [target, setTarget] = useState("");
  const [trust, setTrust] = useState<Trust>(Trust.VERIFIED);
  const now = nowSec();
  const stable = vault.assets[0];
  const canRegister = Boolean(roles & (ROLE_OWNER | ROLE_APPROVER));
  const isOwner = Boolean(roles & ROLE_OWNER);
  const scan = () => { scanBus.request((a) => setTarget(a)); nav.navigate("Scan"); };
  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Address book</Text>} right={<IconButton name="plus" tone="accent" onPress={() => { setTarget(""); setDialog("register"); }} />} />}>
      <View style={{ padding: 16 }}>
        {vault.activityLoading ? <Empty icon="loader">Reading recipients from the chain…</Empty> : vault.recipients.length === 0 ? <Empty icon="book">No recipients yet. Register one to start its activation clock.</Empty> : (
          <Card flush>
            {vault.recipients.map((r, i) => {
              const active = Number(r.activatesAt) <= now;
              return (
                <Row key={r.address} leading={<Identicon address={r.address} size={40} />} title={short(r.address, 6)} subtitle={`${r.paymentCount.toString()} payment${r.paymentCount === 1n ? "" : "s"}${stable ? ` · ${fmtAmount(r.totalPaid, stable.decimals, stable.symbol)} paid` : ""} · ${active ? "active" : `activates ${fmtRelative(r.activatesAt)}`}`}
                  trailing={<TrustBadge trust={r.trust} />} chevron={isOwner} onPress={isOwner ? () => { setTarget(r.address); setTrust(r.trust === Trust.VERIFIED ? Trust.TRUSTED : Trust.VERIFIED); setDialog("trust"); } : undefined} last={i === vault.recipients.length - 1} />
              );
            })}
          </Card>
        )}
        <TxStatus state={tx.state} />
      </View>

      <Sheet open={dialog === "register"} onClose={() => setDialog(null)} title="New entry">
        <Field label="Address" hint="Starts the activation delay now.">
          <View style={{ flexDirection: "row", gap: 8 }}><Input value={target} onChangeText={(t) => setTarget(t.trim())} placeholder="0x…" mono style={{ flex: 1 }} /><IconButton name="maximize" onPress={scan} /></View>
        </Field>
        {!canRegister && <Notice tone="neutral">Only an owner or approver signer can register a recipient.</Notice>}
        <Button disabled={!isAddress(target) || !canRegister || tx.busy} loading={tx.busy} onPress={() => { void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "registerRecipient", args: [target as `0x${string}`] }); setDialog(null); }}>Register</Button>
      </Sheet>

      <Sheet open={dialog === "trust"} onClose={() => setDialog(null)} title="Propose a trust change">
        <Field label="Address"><Input value={target} onChangeText={(t) => setTarget(t.trim())} placeholder="0x…" mono /></Field>
        <Field label="Trust state" hint="Raising trust waits out the delay and can be vetoed.">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[Trust.VERIFIED, Trust.TRUSTED, Trust.RESTRICTED, Trust.BLOCKED].map((t) => (
              <Pressable key={t} onPress={() => setTrust(t)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: trust === t ? C.accent : C.card2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: trust === t ? C.onAccent : C.text }}>{TRUST_LABEL[t]}</Text></Pressable>
            ))}
          </View>
        </Field>
        <Button disabled={!isAddress(target) || !isOwner || tx.busy} loading={tx.busy} onPress={() => { void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeRecipientTrust", args: [target as `0x${string}`, trust] }); setDialog(null); }}>Propose</Button>
        <Text style={[s.hint, { marginTop: 10 }]}>Recorded {fmtDate(BigInt(now))} by {short(vault.address)}</Text>
      </Sheet>
    </Screen>
  );
}
