import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { BackButton, Button, Card, CircleIcon, Expandable, Row, Screen, SectionLabel, TopBar } from '../components/ui';
import { useTheme } from '../state/theme';
import { F } from '../theme';

const SUPPORT_EMAIL = 'support@skur.app';
const DOCS_URL = 'https://github.com/Emmyhack/skur#readme';
const ISSUES_URL = 'https://github.com/Emmyhack/skur/issues/new';

const FAQS: [string, string][] = [
  [
    'What happens if I lose my phone?',
    'The key is gone with it — it never leaves the secure element. Your address is still a member of the vault, and guardian recovery can move your roles to a new key after a delay any owner can cancel. The treasury is never at the mercy of one device.',
  ],
  [
    'Why does a payment sometimes wait?',
    'The vault scores every payment by amount, destination and today’s outflow. High-risk and critical payments carry a timelock so a theft in progress can be vetoed before it settles.',
  ],
  [
    'Can the app move money on its own?',
    'No. Every rule is enforced by a Move object on Sui. The app proposes, approves and executes only what the vault itself permits — and only after the OS releases the key behind your biometric.',
  ],
  [
    'Who can see the vault?',
    'Anyone. A vault is a shared object; balances, policy and proposals are public reads. What is gated is money leaving, never reading.',
  ],
];

/** Screen 21 — help: answers first, humans second. */
export function Help({ onBack }: { onBack: () => void }) {
  const C = useTheme();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Help & Support" />}
      footer={
        <Button icon="message-circle" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}>
          Chat with Support
        </Button>
      }
    >
      <View style={{ gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <CircleIcon name="help-circle" size={56} tone="accent" />
          <Text style={{ fontFamily: F.display, fontSize: 20, color: C.text }}>Need assistance?</Text>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: C.text2 }}>We&apos;re here to help.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>FAQs · Common questions</SectionLabel>
          {FAQS.map(([question, answer], i) => (
            <Expandable
              key={question}
              title={question}
              icon="help-circle"
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            >
              <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>{answer}</Text>
            </Expandable>
          ))}
        </View>

        <Card flush>
          <Row
            leading={<CircleIcon name="book-open" size={34} />}
            title="Documentation"
            subtitle="Learn more about Skur"
            onPress={() => void Linking.openURL(DOCS_URL).catch(() => undefined)}
            chevron
          />
          <Row
            leading={<CircleIcon name="mail" size={34} />}
            title="Contact Support"
            subtitle={SUPPORT_EMAIL}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
            chevron
          />
          <Row
            leading={<CircleIcon name="alert-octagon" size={34} />}
            title="Report an Issue"
            subtitle="Bug or feedback"
            onPress={() => void Linking.openURL(ISSUES_URL).catch(() => undefined)}
            chevron
            last
          />
        </Card>
      </View>
    </Screen>
  );
}
