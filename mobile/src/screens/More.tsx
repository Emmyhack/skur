import { View } from 'react-native';
import { Card, CircleIcon, Row, Screen, TopBar } from '../components/ui';

/** The fifth tab: everything that is not money-in-motion, one tap deep. */
export function More({
  onOpen,
}: {
  onOpen: (screen: 'Security' | 'Policies' | 'Logs' | 'Receive' | 'Settings' | 'Help') => void;
}) {
  return (
    <Screen top={<TopBar title="More" />}>
      <View style={{ gap: 12 }}>
        <Card flush>
          <Row
            leading={<CircleIcon name="shield" size={36} tone="ok" />}
            title="Security Center"
            subtitle="Posture, the brake, maximum possible loss"
            onPress={() => onOpen('Security')}
            chevron
          />
          <Row
            leading={<CircleIcon name="sliders" size={36} />}
            title="Spending Policies"
            subtitle="The rules every payment is scored against"
            onPress={() => onOpen('Policies')}
            chevron
          />
          <Row
            leading={<CircleIcon name="file-text" size={36} />}
            title="Activity Logs"
            subtitle="Everything that happened, by whom"
            onPress={() => onOpen('Logs')}
            chevron
          />
          <Row
            leading={<CircleIcon name="download" size={36} />}
            title="Receive"
            subtitle="The vault's address and accepted assets"
            onPress={() => onOpen('Receive')}
            chevron
            last
          />
        </Card>
        <Card flush>
          <Row
            leading={<CircleIcon name="settings" size={36} />}
            title="Settings"
            subtitle="Profile, wallet, appearance, notifications"
            onPress={() => onOpen('Settings')}
            chevron
          />
          <Row
            leading={<CircleIcon name="help-circle" size={36} tone="accent" />}
            title="Help & Support"
            subtitle="FAQs, documentation, contact"
            onPress={() => onOpen('Help')}
            chevron
            last
          />
        </Card>
      </View>
    </Screen>
  );
}
