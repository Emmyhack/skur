import { useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Notice, Sheet } from './ui';
import { useTheme } from '../state/theme';
import { F, R } from '../theme';

/**
 * The QR scanner behind the icon in the recipient field. Only a Sui address is accepted —
 * a QR that decodes to anything else is said out loud rather than silently pasted.
 */
const ADDRESS = /0x[0-9a-fA-F]{40,64}/;

export function ScanSheet({
  open,
  onClose,
  onAddress,
}: {
  open: boolean;
  onClose: () => void;
  onAddress: (address: string) => void;
}) {
  const C = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState<string | null>(null);

  const handle = (data: string) => {
    const match = ADDRESS.exec(data.trim());
    if (match) {
      setRejected(null);
      onAddress(match[0]);
      onClose();
    } else {
      setRejected(data.slice(0, 48));
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Scan an address">
      <View style={{ gap: 14, paddingBottom: 8 }}>
        {!permission?.granted ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
              Point the camera at a recipient&apos;s address QR. The camera is used for this and
              nothing else.
            </Text>
            <Button icon="camera" onPress={() => void requestPermission()}>
              Allow the camera
            </Button>
            {permission && !permission.granted && !permission.canAskAgain ? (
              <Notice tone="warn">
                Camera access is off for Skur. Turn it on in the system settings to scan.
              </Notice>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ borderRadius: R.lg, overflow: 'hidden', height: 320, backgroundColor: '#000' }}>
              {open ? (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => handle(data)}
                />
              ) : null}
            </View>
            {rejected ? (
              <Notice tone="warn">That QR does not carry a Sui address: “{rejected}…”</Notice>
            ) : (
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3, textAlign: 'center' }}>
                Looking for a QR…
              </Text>
            )}
          </View>
        )}
      </View>
    </Sheet>
  );
}
