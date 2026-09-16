import { useNavigation } from "@react-navigation/native";
import { Text, View } from "react-native";
import type { VaultData } from "@web/lib/vaultReads";
import { Identicon } from "../components/Identicon";
import { Address, BackButton, Card, Screen, Tape, TopBar, s } from "../components/ui";
import { C, F } from "../theme";

export function Receive({ vault }: { vault: VaultData }) {
  const nav = useNavigation<{ goBack: () => void }>();
  return (
    <Screen top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Receive</Text>} />}>
      <Card style={{ alignItems: "center", paddingVertical: 28 }}>
        <Identicon address={vault.address} size={72} />
        <Text style={{ fontFamily: F.display, fontSize: 20, color: C.text, marginTop: 14 }}>Vault address</Text>
        <Text style={[s.rowSub, { textAlign: "center", marginTop: 4, marginBottom: 16 }]}>Ark Constellation devnet · chain 9000</Text>
        <View style={{ backgroundColor: C.canvas, borderRadius: 12, padding: 14, width: "100%" }}><Address value={vault.address} full style={{ color: C.text, fontSize: 14, lineHeight: 22 }} /></View>
        <Text style={[s.hint, { textAlign: "center", marginTop: 14 }]}>Tap to copy. Deposits are accepted in every mode, including Lockdown.</Text>
      </Card>
      <Tape />
    </Screen>
  );
}
