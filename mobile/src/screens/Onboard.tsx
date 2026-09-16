import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurFactoryAbi } from "@web/abi/SkurFactory";
import { DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { publicClient } from "../lib/client";
import { scanBus } from "../lib/scanBus";
import { useStore } from "../state/store";
import { useTheme } from "../state/theme";
import { Identicon } from "../components/Identicon";
import { Card, CircleIcon, Icon, IconButton, Input, Logo, Row, Screen, Sheet, TopBar, useStyles } from "../components/ui";
import { F } from "../theme";

/** Add an account, the way a wallet does it: a short title, then the ways in, as rows. */
export function Onboard() {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ navigate: (n: string) => void }>();
  const { setVaultAddress, signer, createSigner, labels } = useStore();
  const [sheet, setSheet] = useState(false);
  const [addr, setAddr] = useState("");
  const [mine, setMine] = useState<`0x${string}`[]>([]);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!signer) return;
    setLooking(true);
    publicClient.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [signer.address] })
      .then((v) => setMine([...v].filter((a) => a.toLowerCase() !== DEPLOYMENTS.demoVault.toLowerCase())))
      .catch(() => setMine([]))
      .finally(() => setLooking(false));
  }, [signer]);

  const open = (a: `0x${string}`) => { setSheet(false); void setVaultAddress(a); };

  return (
    <Screen top={<TopBar left={<Logo size={28} />} right={<IconButton name="maximize" label="Scan" onPress={() => { scanBus.request((a) => open(a as `0x${string}`)); nav.navigate("Scan"); }} />} />}>
      <Text style={{ fontFamily: F.display, fontSize: 34, color: C.text, letterSpacing: -1, marginTop: 18 }}>Add a vault</Text>
      <Text style={[s.rowSub, { fontSize: 15, marginTop: 6, marginBottom: 20 }]}>Open one you belong to, or watch any vault by address.</Text>

      {signer && (
        <>
          <Text style={s.sectionLabel}>Your vaults</Text>
          <Card flush>
            {looking && mine.length === 0 ? <Row leading={<CircleIcon name="loader" size={40} />} title="Looking up your vaults…" subtitle={short(signer.address)} last />
              : mine.length === 0 ? <Row leading={<CircleIcon name="user" size={40} />} title="No vault has this signer yet" subtitle={`Add ${short(signer.address)} as a member`} last />
              : mine.map((v, i) => <Row key={v} leading={<Identicon address={v} size={40} />} title={labels[v.toLowerCase()] ?? "Treasury vault"} subtitle={short(v, 6)} onPress={() => open(v)} chevron last={i === mine.length - 1} />)}
          </Card>
        </>
      )}

      <Text style={s.sectionLabel}>Get started</Text>
      <Card flush>
        <Row leading={<CircleIcon name="plus" size={40} tone="accent" />} title="Create a vault" subtitle="Name, template, members" onPress={() => nav.navigate("CreateVault")} chevron />
        <Row leading={<CircleIcon name="search" size={40} />} title="Watch a vault" subtitle="Read any vault by its address" onPress={() => setSheet(true)} chevron />
        <Row leading={<Identicon address={DEPLOYMENTS.demoVault} size={40} />} title="Demo vault" subtitle={short(DEPLOYMENTS.demoVault, 6)} onPress={() => open(DEPLOYMENTS.demoVault)} chevron />
        {!signer && <Row leading={<CircleIcon name="key" size={40} />} title="Create a signer key" subtitle="Kept in this phone's keychain" onPress={() => void createSigner()} chevron last />}
        <Row leading={<CircleIcon name="smartphone" size={40} />} title="Signers on this phone" subtitle={signer ? short(signer.address) : "None yet"} onPress={() => nav.navigate("Signers")} chevron last={Boolean(signer)} />
      </Card>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 20 }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 9, color: C.onAccent }}>A</Text></View>
        <Text style={s.hint}>Ark Constellation devnet · chain 9000</Text>
      </View>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Watch a vault">
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Input value={addr} onChangeText={(t) => setAddr(t.trim())} placeholder="0x… vault address" mono autoFocus style={{ flex: 1 }} />
          <IconButton name="maximize" label="Scan" onPress={() => { setSheet(false); scanBus.request((a) => setAddr(a)); nav.navigate("Scan"); }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open vault" disabled={!isAddress(addr)} onPress={() => open(addr as `0x${string}`)}
          style={({ pressed }) => ({ height: 48, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: !isAddress(addr) ? 0.4 : pressed ? 0.85 : 1 })}>
          <Icon name="unlock" size={16} color={C.onAccent} />
          <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.onAccent }}>Open vault</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
