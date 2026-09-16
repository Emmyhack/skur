import { useNavigation } from "@react-navigation/native";
import { Text } from "react-native";
import type { VaultData } from "@web/lib/vaultReads";
import { Address, Button, Card, Screen, s } from "../components/ui";

export function Receive({ vault }: { vault: VaultData }) {
  const nav = useNavigation<{ goBack: () => void }>();
  return (
    <Screen title="Receive" sub="Deposits are accepted in every mode, including Lockdown">
      <Card title="Vault address">
        <Address value={vault.address} full />
        <Text style={[s.hint, { marginTop: 10 }]}>Tap the address to copy it. Send KASH or any approved token to this address on the Ark Constellation devnet, chain 9000.</Text>
      </Card>
      <Button kind="ghost" onPress={() => nav.goBack()}>Back</Button>
    </Screen>
  );
}
