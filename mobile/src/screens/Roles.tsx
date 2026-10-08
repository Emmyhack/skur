import { Text, View } from 'react-native';
import { BackButton, Badge, Card, Screen, TopBar } from '../components/ui';
import { CircleIcon } from '../components/ui';
import { ROLE_SPECS } from '../lib/roles';
import { useTheme } from '../state/theme';
import { F } from '../theme';

const ICONS = { owner: 'key', admin: 'sliders', signer: 'edit-3', guardian: 'shield', viewer: 'eye' } as const;

/**
 * Screen 16 — what each role may do. These map one-to-one onto the capabilities the contract
 * enforces, so nothing promised here can drift from what a key can actually sign.
 */
export function Roles({ onBack }: { onBack: () => void }) {
  const C = useTheme();
  return (
    <Screen top={<TopBar left={<BackButton onPress={onBack} />} title="Roles & Permissions" />}>
      <View style={{ gap: 12 }}>
        {ROLE_SPECS.map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <CircleIcon name={ICONS[r.id]} size={36} tone={r.id === 'guardian' ? 'info' : 'dark'} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: C.text, flex: 1 }}>{r.title}</Text>
              {r.id === 'guardian' ? <Badge tone="info">Separate plane</Badge> : null}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>{r.grants}</Text>
          </Card>
        ))}
        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
          Each role has specific permissions to ensure security and control. A guardian deliberately
          holds no treasury role: its whole value is being a brake an attacker has to breach
          separately, so the contract refuses to combine it with any of the others.
        </Text>
      </View>
    </Screen>
  );
}
