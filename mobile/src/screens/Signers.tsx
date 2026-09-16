import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { roleNames } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { Address, BackButton, Badge, Button, Card, CircleIcon, Field, Icon, Input, Notice, Row, Screen, SectionLabel, TopBar, s } from "../components/ui";
import { C, F } from "../theme";

/** Safe's "Select signer": every key on this phone, which one signs, and how to add or remove one. */
export function Signers({ vault }: { vault: VaultData | undefined }) {
  const nav = useNavigation<{ goBack: () => void }>();
  const { signers, signer, setActiveSigner, createSigner, importSigner, removeSigner } = useStore();
  const [importing, setImporting] = useState(false);
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const rolesOf = (a: string) => vault?.members.find((m) => m.address.toLowerCase() === a.toLowerCase())?.roles ?? 0;
  return (
    <Screen padded={false} top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Select signer</Text>} />}>
      <View style={{ padding: 16 }}>
        {signers.length === 0 && <Notice tone="neutral">No signer on this phone yet. Create a key here, then add its address as a member of your vault, or import a key you already use.</Notice>}
        {signers.length > 0 && (
          <Card flush>
            {signers.map((sg, i) => {
              const r = rolesOf(sg.address);
              return (
                <Row key={sg.address} leading={<Identicon address={sg.address} size={40} />} title={sg.label} subtitle={<Address value={sg.address} />} onPress={() => void setActiveSigner(sg.address)} last={i === signers.length - 1}
                  trailing={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{r ? <Badge tone="accent">{roleNames(r).join(" · ")}</Badge> : vault ? <Badge tone="neutral">no role</Badge> : null}{signer?.address === sg.address ? <Icon name="check" size={18} color={C.accent} /> : null}</View>} />
              );
            })}
          </Card>
        )}
        <SectionLabel>Add a signer</SectionLabel>
        <Card flush>
          <Row leading={<CircleIcon name="key" size={36} tone="accent" />} title="Create a signer key" subtitle="Generated and kept in the device keychain" onPress={() => void createSigner()} chevron />
          <Row leading={<CircleIcon name="download" size={36} />} title="Import a private key" subtitle="A key you already use as a member" onPress={() => setImporting((v) => !v)} chevron last={!importing} />
          {importing && (
            <View style={{ padding: 16, paddingTop: 4 }}>
              <Field label="Private key"><Input value={key} onChangeText={setKey} placeholder="0x…" mono secureTextEntry /></Field>
              <Button kind="secondary" disabled={key.trim().length < 64} onPress={() => { importSigner(key).then(() => { setKey(""); setErr(null); setImporting(false); }).catch((e) => setErr((e as Error).message)); }}>Import key</Button>
              {err && <Notice tone="bad">{err}</Notice>}
            </View>
          )}
        </Card>
        {signer && (
          <>
            <SectionLabel>Active signer</SectionLabel>
            <Card flush>
              <Row leading={<CircleIcon name="trash-2" size={36} tone="error" />} title={<Text style={[s.rowTitle, { color: C.error }]}>Remove {signer.label}</Text>} subtitle="Deletes the key from this phone" chevron last
                onPress={() => Alert.alert("Remove signer key?", "The key is deleted from this phone. Anything it can sign for becomes unreachable from here unless you have it backed up.", [{ text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void removeSigner(signer.address) }])} />
            </Card>
          </>
        )}
        <Text style={[s.hint, { marginTop: 4 }]}>Keys never leave the phone. Only signed transactions do. The active signer is the one the Sign bar uses.</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.text3, marginTop: 8 }}>{signers.length} key{signers.length === 1 ? "" : "s"} on this device</Text>
      </View>
    </Screen>
  );
}
