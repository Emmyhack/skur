import { Text, View } from 'react-native';
import { Button, Logo, Screen } from '../../components/ui';
import { useTheme } from '../../state/theme';
import { F } from '../../theme';
import { NETWORK } from '../../lib/config';

/** Screen 1 — the front door. */
export function Launch({ onStart }: { onStart: () => void }) {
  const C = useTheme();
  return (
    <Screen
      footer={
        <Button onPress={onStart} icon="arrow-right" testID="get-started">
          Get started
        </Button>
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 120 }}>
        <Logo size={72} wordmark={false} />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: F.display, fontSize: 40, color: C.text, letterSpacing: -1 }}>Skur</Text>
          <Text style={{ fontFamily: F.bodyMedium, fontSize: 15, color: C.text2 }}>
            Secure. Shared. On Sui.
          </Text>
        </View>
        <Text
          style={{
            fontFamily: F.body,
            fontSize: 14,
            lineHeight: 21,
            color: C.text3,
            textAlign: 'center',
            maxWidth: 280,
            marginTop: 12,
          }}
        >
          The mobile treasury security layer for teams, DAOs and businesses building on Sui.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.text3, marginTop: 24 }}>
          Sui · {NETWORK} · not audited
        </Text>
      </View>
    </Screen>
  );
}
