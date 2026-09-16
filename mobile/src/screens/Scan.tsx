import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../state/theme";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { isAddress } from "viem";
import { scanBus } from "../lib/scanBus";
import { BackButton, Button, Notice, Screen, Tape, TopBar, useStyles } from "../components/ui";
import { F } from "../theme";

/** QR scanner for vault and recipient addresses, as Safe's scan button. Accepts a bare address or an EIP-681 "ethereum:0x…" URI. */
export function Scan() {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ goBack: () => void }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [err, setErr] = useState<string | null>(null);
  const done = useRef(false);
  const onScanned = ({ data }: { data: string }) => {
    if (done.current) return;
    const m = data.match(/0x[0-9a-fA-F]{40}/);
    if (!m || !isAddress(m[0])) { setErr("That code does not contain an address."); return; }
    done.current = true; scanBus.deliver(m[0]); nav.goBack();
  };
  return (
    <Screen top={<TopBar left={<BackButton onPress={() => { scanBus.clear(); nav.goBack(); }} />} center={<Text style={s.topTitle}>Scan</Text>} />}>
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: C.card, height: 380, alignItems: "center", justifyContent: "center" }}>
        {permission?.granted ? (
          <CameraView style={{ width: "100%", height: "100%" }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
        ) : (
          <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
            <Text style={{ fontFamily: F.body, color: C.text2, textAlign: "center" }}>Skur needs the camera to read a QR code. Nothing is recorded.</Text>
            <Button onPress={() => void requestPermission()}>Allow camera</Button>
          </View>
        )}
      </View>
      <Tape />
      <Text style={[s.hint, { textAlign: "center", marginTop: 12 }]}>Point at a vault or recipient address QR code.</Text>
      {err ? <Notice tone="bad">{err}</Notice> : null}
    </Screen>
  );
}
