import { useState } from "react";
import { useTheme } from "../state/theme";
import { Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurFactoryAbi } from "@web/abi/SkurFactory";
import { DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { publicClient } from "../lib/client";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { Button, Card, CircleIcon, Field, Input, Logo, Notice, Row, Screen, Tape, TopBar, useStyles } from "../components/ui";
import { F } from "../theme";

/** First screen: the web logo, then open a vault by address, the demo vault, or one the device signer belongs to. */
export function Onboard() {
  const C = useTheme(); const s = useStyles();
  const { setVaultAddress, signer, createSigner } = useStore();
  const [addr, setAddr] = useState("");
  const [mine, setMine] = useState<`0x${string}`[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const findMine = async () => {
    if (!signer) return;
    setBusy(true); setErr(null);
    try { const v = await publicClient.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [signer.address] }); setMine([...v]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Screen top={<TopBar left={<Logo size={30} />} />}>
      <View style={{ marginTop: 28, marginBottom: 22 }}>
        <Text style={{ fontFamily: F.display, fontSize: 40, lineHeight: 44, color: C.text, letterSpacing: -1 }}>Treasury security{"\n"}that assumes{"\n"}<Text style={{ backgroundColor: C.accent, color: C.onAccent }}>compromise</Text></Text>
        <Text style={[s.rowSub, { fontSize: 15, lineHeight: 22, marginTop: 14 }]}>Read its balances, queue and policy. Sign from this phone.</Text>
      </View>
      <Tape />
      <Card style={{ marginTop: 16 }}>
        <Field label="Vault address"><Input value={addr} onChangeText={(t) => setAddr(t.trim())} placeholder="0x…" mono /></Field>
        <Button disabled={!isAddress(addr)} onPress={() => setVaultAddress(addr as `0x${string}`)} icon="unlock">Open vault</Button>
      </Card>
      <Card flush>
        <Row leading={<Identicon address={DEPLOYMENTS.demoVault} size={36} />} title="Demo vault" subtitle={short(DEPLOYMENTS.demoVault, 6)} onPress={() => setVaultAddress(DEPLOYMENTS.demoVault)} chevron />
        {signer ? (
          mine === null ? <Row leading={<CircleIcon name="search" size={36} />} title="Vaults this device belongs to" subtitle={`Signer ${short(signer.address)}`} onPress={findMine} trailing={busy ? <Text style={s.hint}>looking…</Text> : undefined} chevron last />
          : mine.length === 0 ? <Row leading={<CircleIcon name="user" size={36} />} title="No vault has this signer yet" subtitle={`Add ${short(signer.address)} as a member to sign for one`} last />
          : mine.map((v, i) => <Row key={v} leading={<Identicon address={v} size={36} />} title="Member vault" subtitle={short(v, 6)} onPress={() => setVaultAddress(v)} chevron last={i === mine.length - 1} />)
        ) : (
          <Row leading={<CircleIcon name="key" size={36} tone="accent" />} title="Create a signer key" subtitle="Kept in this phone's keychain" onPress={() => void createSigner()} chevron last />
        )}
      </Card>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <Text style={[s.hint, { textAlign: "center", marginTop: 8 }]}>Verified contracts. Skur holds no keys and no funds.</Text>
    </Screen>
  );
}
