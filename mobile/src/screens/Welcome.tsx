import { Text, View } from 'react-native';
import { Button, Logo, Screen, Tape } from '../components/ui';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { NETWORK } from '../lib/config';

const POINTS: [string, string][] = [
  ['Approvals that follow the risk', 'The amount, the destination, today’s outflow and the vault’s posture decide how much sign-off a payment needs.'],
  ['A brake you can reach', 'Freeze the vault from anywhere. Any guardian can veto a critical payment before it settles.'],
  ['Your key stays on the phone', 'Held in the secure element behind your face or fingerprint, and released for one action at a time.'],
];

export function Welcome({ onStart }: { onStart: () => void }) {
  const C = useTheme();
  return (
    <Screen
      footer={
        <Button onPress={onStart} icon="arrow-right">
          Get started
        </Button>
      }
    >
      <View style={{ gap: 28, paddingTop: 16 }}>
        <Logo size={34} />
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: F.display, fontSize: 32, lineHeight: 37, color: C.text }}>
            A valid signature is not a safe payment
          </Text>
          <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 24, color: C.text2 }}>
            Skur decides how much authorization a payment needs, and whether it may settle right
            now — enforced in Move, in a shared object anyone can read.
          </Text>
        </View>
        <Tape />
        <View style={{ gap: 20 }}>
          {POINTS.map(([title, body]) => (
            <View key={title} style={{ gap: 4 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text }}>{title}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
                {body}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.text3 }}>
          Sui · {NETWORK} · not audited
        </Text>
      </View>
    </Screen>
  );
}
