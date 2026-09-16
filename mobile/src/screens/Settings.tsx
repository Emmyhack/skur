import * as LocalAuthentication from "expo-local-authentication";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Alert, Linking, Switch, Text, View } from "react-native";
import { ARK_DEVNET_EXPLORER, ARK_DEVNET_RPC, DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { roleNames } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { Address, Badge, Button, Card, CircleIcon, Field, Input, Logo, Notice, Row, Screen, SectionLabel, TopBar, s } from "../components/ui";
import { C } from "../theme";

export function Settings({ vault }: { vault: VaultData | undefined }) {
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { vaultAddress, setVaultAddress, labels, setLabel, signer, createSigner, importSigner, removeSigner, biometrics, setBiometrics } = useStore();
  const roles = useMyRoles(vault);
  const [name, setName] = useState(vaultAddress ? labels[vaultAddress.toLowerCase()] ?? "" : "");
  const [importing, setImporting] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  useEffect(() => { void (async () => setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))(); }, []);

  return (
    <Screen padded={false} top={<TopBar title="Settings" right={<Logo size={26} wordmark={false} />} />}>
      <View style={{ padding: 16 }}>
        <SectionLabel>Vault</SectionLabel>
        <Card flush>
          {vaultAddress ? (
            <>
              <Row leading={<Identicon address={vaultAddress} size={40} badge={vault ? `${vault.policy.approvalsLow}/${vault.counts.approvers}` : undefined} />} title={<Input value={name} onChangeText={(t) => { setName(t); void setLabel(vaultAddress, t); }} placeholder="Treasury vault" maxLength={40} style={{ height: 36, paddingHorizontal: 10, backgroundColor: "transparent", borderWidth: 0, fontFamily: "DMSans_700Bold" }} />} subtitle={<Address value={vaultAddress} />} />
              <Row leading={<CircleIcon name="file-text" size={36} />} title="Policy" subtitle={vault ? `v${vault.policyVersion} · ${vault.members.length} members` : "…"} />
              <Row leading={<CircleIcon name="shield" size={36} />} title="Security" subtitle="Mode, guardians, posture, maximum loss" onPress={() => nav.navigate("Security")} chevron />
              <Row leading={<CircleIcon name="external-link" size={36} />} title="View on Blockscout" onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vaultAddress}`)} chevron />
              <Row leading={<CircleIcon name="repeat" size={36} />} title="Switch vault" onPress={() => void setVaultAddress(null)} chevron last />
            </>
          ) : <Row leading={<CircleIcon name="unlock" size={36} />} title="Open a vault" onPress={() => void setVaultAddress(null)} chevron last />}
        </Card>

        <SectionLabel>Signer on this phone</SectionLabel>
        <Card flush>
          {signer ? (
            <>
              <Row leading={<Identicon address={signer.address} size={40} />} title="Device signer" subtitle={<Address value={signer.address} />} trailing={roles ? <Badge tone="accent">{roleNames(roles).join(" · ")}</Badge> : <Badge tone="neutral">no role here</Badge>} />
              <Row leading={<CircleIcon name="smartphone" size={36} />} title="Require Face ID to sign" subtitle={bioAvailable ? "Prompted before every signature" : "No biometrics enrolled on this device"} trailing={<Switch value={biometrics} onValueChange={(v) => void setBiometrics(v)} trackColor={{ true: C.accent }} />} />
              <Row leading={<CircleIcon name="trash-2" size={36} tone="error" />} title={<Text style={[s.rowTitle, { color: C.error }]}>Remove signer key</Text>} subtitle="Deletes the key from this phone" onPress={() => Alert.alert("Remove signer key?", "The key is deleted from this phone. Anything it can sign for becomes unreachable from here unless you have it backed up.", [{ text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void removeSigner() }])} chevron last />
            </>
          ) : (
            <>
              <Row leading={<CircleIcon name="key" size={36} tone="accent" />} title="Create a signer key" subtitle="Generated and kept in the device keychain" onPress={() => void createSigner()} chevron />
              <Row leading={<CircleIcon name="download" size={36} />} title="Import a private key" subtitle="A key you already use as a member" onPress={() => setImporting((v) => !v)} chevron last={!importing} />
              {importing && (
                <View style={{ padding: 16, paddingTop: 4 }}>
                  <Field label="Private key"><Input value={importKey} onChangeText={setImportKey} placeholder="0x…" mono secureTextEntry /></Field>
                  <Button kind="secondary" disabled={importKey.trim().length < 64} onPress={() => { try { void importSigner(importKey); setImportKey(""); setImportErr(null); setImporting(false); } catch (e) { setImportErr((e as Error).message); } }}>Import key</Button>
                  {importErr && <Notice tone="bad">{importErr}</Notice>}
                </View>
              )}
            </>
          )}
        </Card>
        <Text style={[s.hint, { marginBottom: 6 }]}>The private key never leaves the phone. Only signed transactions do. Give this address a role in a vault to sign for it.</Text>

        <SectionLabel>Environment</SectionLabel>
        <Card flush>
          <Row leading={<CircleIcon size={36} tone="accent" text="A" />} title="Ark Constellation devnet" subtitle="chain 9000" />
          <Row leading={<CircleIcon name="server" size={36} />} title="RPC" subtitle={ARK_DEVNET_RPC.replace("https://", "")} />
          <Row leading={<CircleIcon name="box" size={36} />} title="Factory" subtitle={<Address value={DEPLOYMENTS.factory} />} />
          <Row leading={<CircleIcon name="cpu" size={36} />} title="Vault implementation" subtitle={<Address value={DEPLOYMENTS.vaultImplementation} />} />
          <Row leading={<CircleIcon name="info" size={36} />} title="Skur V1" subtitle={`demo vault ${short(DEPLOYMENTS.demoVault)}`} last />
        </Card>
        <Text style={s.hint}>If this app ever disappears, the vault stays reachable through these endpoints and the verified contracts on the explorer.</Text>
      </View>
    </Screen>
  );
}
