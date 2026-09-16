import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { Alert, Linking, Switch, Text, View } from "react-native";
import { ARK_DEVNET_EXPLORER, ARK_DEVNET_RPC, DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { roleNames } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { Address, Badge, Button, Card, Field, Input, KV, Notice, Screen, s } from "../components/ui";
import { C } from "../theme";

export function Settings({ vault }: { vault: VaultData | undefined }) {
  const { vaultAddress, setVaultAddress, labels, setLabel, signer, createSigner, importSigner, removeSigner, biometrics, setBiometrics } = useStore();
  const roles = useMyRoles(vault);
  const [name, setName] = useState(vaultAddress ? labels[vaultAddress.toLowerCase()] ?? "" : "");
  const [importKey, setImportKey] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  useEffect(() => { void (async () => setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))(); }, []);

  return (
    <Screen title="Settings">
      <Card title="Vault">
        {vaultAddress ? (
          <>
            <Field label="Name" hint="Kept on this phone only. Other members and the chain never see it.">
              <Input value={name} onChangeText={(t) => { setName(t); void setLabel(vaultAddress, t); }} placeholder="Treasury vault" maxLength={40} />
            </Field>
            <KV k="Address" v={<Address value={vaultAddress} />} />
            <KV k="Policy version" v={vault ? `v${vault.policyVersion}` : "…"} />
            <KV k="Members" v={vault ? `${vault.members.length}` : "…"} last />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button kind="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vaultAddress}`)}>Blockscout</Button>
              <Button kind="secondary" style={{ flex: 1 }} onPress={() => void setVaultAddress(null)}>Switch vault</Button>
            </View>
          </>
        ) : <Button onPress={() => void setVaultAddress(null)}>Open a vault</Button>}
      </Card>

      <Card title="Signer on this phone">
        {signer ? (
          <>
            <KV k="Address" v={<Address value={signer.address} />} />
            <KV k="Roles in this vault" v={roles ? roleNames(roles).join(", ") : "not a member"} />
            <View style={{ paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}><Text style={s.kvK}>Require Face ID / biometrics to sign</Text>{!bioAvailable && <Text style={s.hint}>No biometrics enrolled on this device; signing proceeds without a prompt.</Text>}</View>
              <Switch value={biometrics} onValueChange={(v) => void setBiometrics(v)} trackColor={{ true: C.accent }} />
            </View>
            <Text style={[s.hint, { marginBottom: 10 }]}>The private key is stored in the device keychain and never leaves the phone. Only signed transactions do. Give this address a role in a vault to sign for it.</Text>
            <Button kind="danger" onPress={() => Alert.alert("Remove signer key?", "The key is deleted from this phone. Anything it can sign for becomes unreachable from here unless you have it backed up.", [{ text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void removeSigner() }])}>Remove signer key</Button>
          </>
        ) : (
          <>
            <Text style={[s.sub, { marginBottom: 12 }]}>No signer yet. Create a fresh key on this phone, then add its address as a member of your vault, or import a key you already use.</Text>
            <Button onPress={() => void createSigner()}>Create a signer key</Button>
            <Field label="Or import a private key">
              <Input value={importKey} onChangeText={setImportKey} placeholder="0x…" mono secureTextEntry />
            </Field>
            <Button kind="secondary" disabled={importKey.trim().length < 64} onPress={() => { try { void importSigner(importKey); setImportKey(""); setImportErr(null); } catch (e) { setImportErr((e as Error).message); } }}>Import key</Button>
            {importErr && <Notice tone="bad">{importErr}</Notice>}
          </>
        )}
      </Card>

      <Card title="Environment">
        <KV k="Network" v="Ark Constellation devnet · 9000" />
        <KV k="RPC" v={ARK_DEVNET_RPC.replace("https://", "")} mono />
        <KV k="Factory" v={<Address value={DEPLOYMENTS.factory} />} />
        <KV k="Implementation" v={<Address value={DEPLOYMENTS.vaultImplementation} />} />
        <KV k="Demo vault" v={<Address value={DEPLOYMENTS.demoVault} />} last />
        <Text style={[s.hint, { marginTop: 8 }]}>If this app ever disappears, the vault stays reachable through these endpoints and the verified contracts on the explorer. <Badge tone="neutral">Skur V1 · {short(DEPLOYMENTS.demoVault)}</Badge></Text>
      </Card>
    </Screen>
  );
}
