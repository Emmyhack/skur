import { Text, View } from 'react-native';
import { Button, Logo, Screen } from '../../components/ui';
import { useTheme } from '../../state/theme';
import { F, R } from '../../theme';

/** Screen 3 — create a new organisation, or join one that already exists. */
export function Start({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const C = useTheme();
  return (
    <Screen
      centered
      footer={
        <View style={{ gap: 10 }}>
          <Button onPress={onCreate} icon="plus" testID="create-org">
            Create New Organisation
          </Button>
          <Button onPress={onJoin} kind="secondary" icon="log-in" testID="join-org">
            Join Organisation
          </Button>
        </View>
      }
    >
      <View style={{ gap: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: F.display, fontSize: 34, lineHeight: 40, color: C.text, textAlign: 'center' }}>
          Welcome to Skur!
        </Text>
        <Text
          style={{ fontFamily: F.body, fontSize: 15, lineHeight: 23, color: C.text2, textAlign: 'center', maxWidth: 300 }}
        >
          Let&apos;s set up your secure organisation and get you started.
        </Text>
        <View
          style={{
            width: 220,
            height: 220,
            borderRadius: R.lg * 2,
            backgroundColor: C.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
          }}
        >
          <Logo size={96} wordmark={false} />
        </View>
      </View>
    </Screen>
  );
}
