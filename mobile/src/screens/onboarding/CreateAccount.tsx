import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BackButton, Button, Field, Icon, Input, Notice, Screen, TopBar } from '../../components/ui';
import { useTheme } from '../../state/theme';
import { F, R } from '../../theme';
import { useStore } from '../../state/store';

/**
 * Screen 4 — who you are.
 *
 * There is deliberately no password and no federated login here. Skur's credential is the signing
 * key in the phone's secure element, created on the next step and released by the OS behind a
 * biometric — a password would be a second, weaker door into the same house. The name and email
 * stay on this device: the chain identifies members by address, and the backend only ever sees
 * what notification registration sends it.
 */
export function CreateAccount({ onBack, onDone, onWallet }: { onBack: () => void; onDone: () => void; onWallet: () => void }) {
  const C = useTheme();
  const { profile, saveProfile } = useStore();
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [agreed, setAgreed] = useState(false);

  const emailOk = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const ready = name.trim().length > 0 && emailOk && agreed;

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Create Account" />}
      footer={
        <Button
          onPress={() => {
            saveProfile({ name: name.trim(), email: email.trim() });
            onDone();
          }}
          disabled={!ready}
          icon="arrow-right"
          testID="create-account"
        >
          Create Account
        </Button>
      }
    >
      <View style={{ gap: 18 }}>
        <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
          Enter your details to get started.
        </Text>

        <Field label="Full name">
          <Input value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        </Field>

        <Field label="Email address" hint="Only used for notifications. Never written on chain.">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </Field>
        {!emailOk ? <Notice tone="warn">That does not look like an email address.</Notice> : null}

        <Pressable
          onPress={() => setAgreed(!agreed)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: R.sm - 2,
              borderWidth: 2,
              borderColor: agreed ? C.accent : C.border,
              backgroundColor: agreed ? C.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agreed ? <Icon name="check" size={14} color={C.onAccent} /> : null}
          </View>
          <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2 }}>
            I agree to the Terms of Service and Privacy Policy.
          </Text>
        </Pressable>

        <Notice tone="info">
          No password. Your signing key — created on the next step, held in this phone&apos;s
          secure element — is the credential.
        </Notice>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <Text style={{ fontFamily: F.body, fontSize: 12, color: C.text3 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>

        <Button kind="secondary" icon="credit-card" onPress={onWallet} testID="continue-wallet">
          Continue with Wallet
        </Button>
        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3, textAlign: 'center', marginTop: -6 }}>
          Skip the profile and go straight to your signing key.
        </Text>
      </View>
    </Screen>
  );
}
