import * as LocalAuthentication from "expo-local-authentication";
import { useScheme, useTheme } from "../state/theme";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Linking, Switch, Text, View } from "react-native";
import { ARK_DEVNET_EXPLORER, ARK_DEVNET_RPC, DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { roleNames } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useMyRoles } from "../hooks/useVault";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { Address, Badge, Button, Card, CircleIcon, Field, Icon, Input, Logo, Notice, Row, Screen, SectionLabel, TopBar, useStyles } from "../components/ui";


export function Settings({ vault }: { vault: VaultData | undefined }) {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { vaultAddress, setVaultAddress, labels, setLabel, signer, biometrics, setBiometrics } = useStore();
  const roles = useMyRoles(vault);
  const [name, setName] = useState(vaultAddress ? labels[vaultAddress.toLowerCase()] ?? "" : "");
  const [bioAvailable, setBioAvailable] = useState(false);
  const { scheme, setScheme } = useScheme();
  useEffect(() => { void (async () => setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))(); }, []);

  return (
    <Screen padded={false} top={<TopBar title="Settings" right={<Logo size={26} wordmark={false} />} />}>
      <View style={{ padding: 16 }}>
        <SectionLabel>Vault</SectionLabel>
        <Card flush>
          {vaultAddress ? (
            <>
              <Row leading={<Identicon address={vaultAddress} size={40} badge={vault ? `${vault.policy.approvalsLow}/${vault.counts.approvers}` : undefined} />} title={<Input value={name} onChangeText={(t) => { setName(t); void setLabel(vaultAddress, t); }} placeholder="Treasury vault" maxLength={40} style={{ height: 36, paddingHorizontal: 10, backgroundColor: "transparent", borderWidth: 0, fontFamily: "DMSans_700Bold" }} />} subtitle={<Address value={vaultAddress} />} />
              <Row leading={<CircleIcon name="file-text" size={36} />} title="Policy" subtitle={vault ? `v${vault.policyVersion} · templates, tiers, delays, caps` : "…"} onPress={() => nav.navigate("Policy")} chevron />
              <Row leading={<CircleIcon name="users" size={36} />} title="Members" subtitle={vault ? `${vault.members.length} members · roles and thresholds` : "…"} onPress={() => nav.navigate("Members")} chevron />
              <Row leading={<CircleIcon name="book" size={36} />} title="Address book" subtitle="Recipients and trust" onPress={() => nav.navigate("AddressBook")} chevron />
              <Row leading={<CircleIcon name="activity" size={36} />} title="Simulator" subtitle="Attacks against the policy" onPress={() => nav.navigate("Simulator")} chevron />
              <Row leading={<CircleIcon name="bell" size={36} />} title="Updates" subtitle="What needs you" onPress={() => nav.navigate("Notifications")} chevron />
              <Row leading={<CircleIcon name="shield" size={36} />} title="Security" subtitle="Mode, guardians, posture" onPress={() => nav.navigate("Security")} chevron />
              <Row leading={<CircleIcon name="external-link" size={36} />} title="View on Blockscout" onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vaultAddress}`)} chevron />
              <Row leading={<CircleIcon name="repeat" size={36} />} title="Switch vault" onPress={() => void setVaultAddress(null)} chevron />
              <Row leading={<CircleIcon name="plus-square" size={36} />} title="Create a new vault" subtitle="One signature" onPress={() => nav.navigate("CreateVault")} chevron last />
            </>
          ) : <><Row leading={<CircleIcon name="unlock" size={36} />} title="Open a vault" onPress={() => void setVaultAddress(null)} chevron /><Row leading={<CircleIcon name="plus-square" size={36} />} title="Create a new vault" onPress={() => nav.navigate("CreateVault")} chevron last /></>}
        </Card>

        <SectionLabel>Signers on this phone</SectionLabel>
        <Card flush>
          <Row leading={signer ? <Identicon address={signer.address} size={40} /> : <CircleIcon name="key" size={40} tone="accent" />} title={signer ? signer.label : "No signer yet"} subtitle={signer ? <Address value={signer.address} /> : "Create or import a key to sign from this phone"} trailing={roles ? <Badge tone="accent">{roleNames(roles).length > 2 ? "All roles" : roleNames(roles).join(" · ")}</Badge> : signer ? <Badge tone="neutral">no role</Badge> : undefined} onPress={() => nav.navigate("Signers")} chevron />
          <Row leading={<CircleIcon name="smartphone" size={36} />} title="Require Face ID to sign" subtitle={bioAvailable ? "Before every signature" : "Not enrolled on this device"} trailing={<Switch value={biometrics} onValueChange={(v) => void setBiometrics(v)} trackColor={{ true: C.accent }} />} last />
        </Card>

        <SectionLabel>Appearance</SectionLabel>
        <Card flush>
          {([["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "System", "smartphone"]] as const).map(([v, label, icon], i) => (
            <Row key={v} leading={<CircleIcon name={icon} size={36} tone={scheme === v ? "accent" : "dark"} />} title={label} onPress={() => setScheme(v)} last={i === 2}
              trailing={scheme === v ? <Icon name="check" size={18} color={C.accent} /> : undefined} />
          ))}
        </Card>

        <SectionLabel>Environment</SectionLabel>
        <Card flush>
          <Row leading={<CircleIcon size={36} tone="accent" text="A" />} title="Ark Constellation devnet" subtitle="chain 9000" />
          <Row leading={<CircleIcon name="server" size={36} />} title="RPC" subtitle={ARK_DEVNET_RPC.replace("https://", "")} />
          <Row leading={<CircleIcon name="box" size={36} />} title="Factory" subtitle={<Address value={DEPLOYMENTS.factory} />} />
          <Row leading={<CircleIcon name="cpu" size={36} />} title="Vault implementation" subtitle={<Address value={DEPLOYMENTS.vaultImplementation} />} />
          <Row leading={<CircleIcon name="info" size={36} />} title="Skur V1" subtitle={`demo vault ${short(DEPLOYMENTS.demoVault)}`} last />
        </Card>
      </View>
    </Screen>
  );
}
