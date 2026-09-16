import { useState } from "react";
import { Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurFactoryAbi } from "@web/abi/SkurFactory";
import { DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { publicClient } from "../lib/client";
import { useStore } from "../state/store";
import { Button, Card, Field, Input, Notice, Screen, Tape, s } from "../components/ui";
import { C, F } from "../theme";

/** First screen: open a vault by address, the demo vault, or one the device signer belongs to. */
export function Onboard() {
  const { setVaultAddress, signer, createSigner } = useStore();
  const [addr, setAddr] = useState("");
  const [mine, setMine] = useState<`0x${string}`[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const findMine = async () => {
    if (!signer) return;
    setBusy(true); setErr(null);
    try { const v = await publicClient.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [signer.address] }); setMine([...v]); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", marginTop: 40, marginBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 30, color: C.onAccent }}>S</Text></View>
        <Text style={[s.h1, { marginTop: 16 }]}>Skur</Text>
        <Text style={[s.sub, { textAlign: "center", maxWidth: 300, marginTop: 6 }]}>Treasury security that assumes compromise. Open a vault to see its balances, queue and policy, and sign from this phone.</Text>
      </View>
      <Tape />
      <Card title="Open a vault" style={{ marginTop: 16 }}>
        <Field label="Vault address">
          <Input value={addr} onChangeText={(t) => setAddr(t.trim())} placeholder="0x…" mono />
        </Field>
        <Button disabled={!isAddress(addr)} onPress={() => setVaultAddress(addr as `0x${string}`)}>Open vault</Button>
        <Button kind="ghost" onPress={() => setVaultAddress(DEPLOYMENTS.demoVault)} style={{ marginTop: 6 }}>Open the demo vault</Button>
      </Card>
      <Card title="Vaults this device belongs to">
        {signer ? (
          <>
            <Text style={[s.sub, { marginBottom: 10 }]}>Signer on this phone: <Text style={s.addr}>{short(signer.address)}</Text></Text>
            {mine === null ? <Button kind="secondary" onPress={findMine} loading={busy}>Find my vaults</Button> : mine.length === 0 ? <Notice tone="neutral">This signer is not a member of any vault yet. You can still open any vault by address.</Notice> : mine.map((v) => <Button key={v} kind="secondary" style={{ marginBottom: 8 }} onPress={() => setVaultAddress(v)}>{short(v, 6)}</Button>)}
            {err ? <Notice tone="bad">{err}</Notice> : null}
          </>
        ) : (
          <>
            <Text style={[s.sub, { marginBottom: 10 }]}>No signer key on this phone yet. Create one to be added as a member, or import an existing key under Settings later.</Text>
            <Button kind="secondary" onPress={() => void createSigner()}>Create a signer key</Button>
          </>
        )}
      </Card>
      <Text style={[s.hint, { textAlign: "center" }]}>You interact directly with verified contracts on the Ark Constellation devnet. Skur never holds keys or funds.</Text>
    </Screen>
  );
}
