import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Address,
  Button,
  Card,
  Field,
  Input,
  Notice,
  Screen,
  SectionLabel,
  Tabs,
  TopBar,
} from '../components/ui';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { biometricSupport, createSigner, importSigner, type BiometricSupport } from '../lib/keystore';
import { useStore } from '../state/store';

/**
 * Setting up the key on this device.
 *
 * The screen is explicit that this is a hot key. An approver or executor key belongs on a phone;
 * a guardian key does not, because a guardian's whole value is being a control plane an attacker
 * has to breach separately — and a guardian key sitting next to an approver key on the same device
 * collapses the two planes the contract works to keep apart.
 */
export function Onboard({ onDone }: { onDone: () => void }) {
  // No screenshots and no screen recording while this screen can hold a private key. The OS also
  // blanks it in the app switcher. Nothing stops a second phone pointed at the first — the copy
  // on the import path says to treat the key accordingly.
  usePreventScreenCapture();
  const C = useTheme();
  const { refreshSigner } = useStore();
  const [mode, setMode] = useState<'create' | 'import'>('create');
  const [bio, setBio] = useState<BiometricSupport | null>(null);
  const [secret, setSecret] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricSupport().then(setBio);
  }, []);

  const act = async () => {
    setError(null);
    setBusy(true);
    try {
      const addr = mode === 'create' ? await createSigner() : await importSigner(secret);
      // Only the local state. Refreshing the store's signer here would swap this screen out from
      // under the user before the confirmation — and its Continue button is what records that
      // onboarding finished. Without that record, every cold start began at the welcome tour.
      setAddress(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (address) {
    return (
      <Screen
        top={<TopBar title="Your key is ready" />}
        footer={
          <Button
            onPress={() => {
              onDone();
              void refreshSigner();
            }}
            icon="arrow-right"
          >
            Continue
          </Button>
        }
      >
        <View style={{ gap: 20 }}>
          <Notice tone="ok">
            The key is in this device&apos;s secure element. It is released for one action at a
            time, after {bio?.label ?? 'a device check'}.
          </Notice>
          <Card>
            <SectionLabel>This device signs as</SectionLabel>
            <Address value={address} full />
          </Card>
          <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
            This address holds no roles yet. An owner of a vault has to add it — as an approver, an
            executor, or both — before it can do anything. Send them the address above.
          </Text>
          <Notice tone="warn">
            Do not use this device for a guardian key. A guardian is the second control plane an
            attacker has to breach; keeping it on the same phone as an approver key defeats the
            point of having two.
          </Notice>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      top={<TopBar title="Set up signing" />}
      footer={
        <Button
          onPress={act}
          loading={busy}
          disabled={busy || (mode === 'import' && secret.trim().length < 20)}
          icon="lock"
        >
          {mode === 'create' ? 'Create a key on this device' : 'Import this key'}
        </Button>
      }
    >
      <View style={{ gap: 20 }}>
        <Tabs
          value={mode}
          options={[
            ['create', 'New key'],
            ['import', 'Import'],
          ]}
          onChange={setMode}
        />

        {bio && !bio.enrolled ? (
          <Notice tone="warn">
            No {bio.available ? bio.label : 'screen lock'} is set up on this device. Set one up
            first — without it the key would sit unprotected.
          </Notice>
        ) : null}

        {mode === 'create' ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text2 }}>
              A new Ed25519 key is generated on the device and written to the secure element. It
              never leaves the phone and is not backed up anywhere.
            </Text>
            <Notice tone="info">
              If you lose this device, the key is gone. That is what the vault&apos;s guardian
              recovery is for: guardians can move your roles to a new key after a delay any owner
              can cancel.
            </Notice>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Field
              label="Private key"
              hint="A suiprivkey1… string. It is validated before anything is stored."
            >
              <Input
                mono
                value={secret}
                onChangeText={setSecret}
                placeholder="suiprivkey1…"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                multiline
              />
            </Field>
            <Notice tone="warn">
              Import a key that is already an approver or executor on your vault. Do not paste a
              key that holds anything you are not prepared to have on a phone.
            </Notice>
          </View>
        )}

        {error ? <Notice tone="bad">{error}</Notice> : null}
      </View>
    </Screen>
  );
}
