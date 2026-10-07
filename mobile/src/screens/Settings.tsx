import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Constants from 'expo-constants';
import {
  Address,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  KV,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Tabs,
  TopBar,
} from '../components/ui';
import { Avatar, SwitchRow } from '../components/kit';
import { useScheme, type Scheme } from '../state/theme';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { API_URL, NETWORK, PACKAGE_ID } from '../lib/config';
import { biometricSupport, forgetSigner, type BiometricSupport } from '../lib/keystore';
import { enablePush, type PushResult } from '../lib/notifications';
import { useStore } from '../state/store';

/**
 * Screen 20 — settings: who you are, the organisation, the wallet on this device, security,
 * notifications and appearance. Dark mode is a switch and a precise preference — the switch flips
 * ground, the segmented control underneath can hand the choice back to the system.
 */
export function Settings({ onOpenHelp, onOpenSecurity }: { onOpenHelp?: () => void; onOpenSecurity?: () => void }) {
  const C = useTheme();
  const { scheme, dark, setScheme } = useScheme();
  const { address, vaultId, profile, saveProfile, closeVault, refreshSigner } = useStore();
  const [bio, setBio] = useState<BiometricSupport | null>(null);
  const [push, setPush] = useState<PushResult | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void biometricSupport().then(setBio);
  }, []);

  const forget = () =>
    Alert.alert(
      'Forget this key?',
      'The key is deleted from this device and cannot be recovered. Your address stays a member of the vault until governance removes it — guardians can move your roles to a new key, which is what recovery is for.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forget it', style: 'destructive', onPress: () => void forgetSigner().then(refreshSigner) },
      ],
    );

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen top={<TopBar title="Settings" />}>
      <View style={{ gap: 20 }}>
        <Card flush>
          <Row
            leading={<Avatar name={profile?.name ?? '•'} size={44} />}
            title={profile?.name ?? 'No name set'}
            subtitle={profile?.email || 'No email — only used for notifications'}
            trailing={
              <IconButton
                name="edit-2"
                label="Edit profile"
                onPress={() => {
                  setName(profile?.name ?? '');
                  setEmail(profile?.email ?? '');
                  setEditing(true);
                }}
              />
            }
            last
          />
        </Card>

        {vaultId ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Organisation</SectionLabel>
            <Card flush>
              <Row title="Vault" subtitle={`${vaultId.slice(0, 18)}…`} />
              <Row title="Close this vault" subtitle="Keeps the key; just stops showing it" onPress={closeVault} last />
            </Card>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <SectionLabel>Wallets</SectionLabel>
          <Card>
            {address ? (
              <>
                <SectionLabel>This device signs as</SectionLabel>
                <Address value={address} full />
                <View style={{ marginTop: 10 }}>
                  <KV k="Unlocked with" v={bio ? (bio.enrolled ? bio.label : 'no screen lock set') : '…'} last />
                </View>
              </>
            ) : (
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.text2 }}>No signing key on this device.</Text>
            )}
          </Card>
          {address ? (
            <Button kind="danger" icon="trash-2" onPress={forget}>
              Forget this key
            </Button>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>Security</SectionLabel>
          <Card flush>
            <Row
              title="Security Center"
              subtitle="Posture, the brake, and maximum possible loss"
              onPress={onOpenSecurity}
              chevron
              last
            />
          </Card>
          <Notice tone="warn">
            This is a hot key: appropriate for an approver or an executor, whose authority is
            bounded by the policy. A guardian key belongs somewhere this phone is not.
          </Notice>
        </View>

        {vaultId && address ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Notifications</SectionLabel>
            <Button
              kind="secondary"
              icon="bell"
              loading={pushBusy}
              disabled={pushBusy || push?.ok === true}
              onPress={() => {
                setPushBusy(true);
                enablePush(vaultId, address)
                  .then(setPush)
                  .catch((e) => setPush({ ok: false, reason: e instanceof Error ? e.message : String(e) }))
                  .finally(() => setPushBusy(false));
              }}
            >
              {push?.ok ? 'Notifications are on' : 'Notify me when a payment needs me'}
            </Button>
            {push && !push.ok ? <Notice tone="warn">{push.reason}</Notice> : null}
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <SectionLabel>Appearance</SectionLabel>
          <Card>
            <SwitchRow
              title="Dark mode"
              subtitle={scheme === 'system' ? 'Currently following the system' : undefined}
              value={dark}
              onChange={(v) => setScheme(v ? 'dark' : 'light')}
              icon="moon"
            />
          </Card>
          <Tabs
            value={scheme}
            options={[
              ['light', 'Light'],
              ['dark', 'Dark'],
              ['system', 'System'],
            ]}
            onChange={(s) => setScheme(s as Scheme)}
          />
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>About</SectionLabel>
          <Card>
            <KV k="App version" v={`v${version}`} />
            <KV k="Chain" v={`Sui ${NETWORK}`} />
            <KV k="Package" v={PACKAGE_ID === '0x0' ? 'not configured' : `${PACKAGE_ID.slice(0, 10)}…`} mono />
            <KV k="Indexer" v={API_URL || 'not configured — reads go straight to the chain'} last />
          </Card>
          <Card flush>
            <Row title="Help & Support" subtitle="FAQs, documentation, contact" onPress={onOpenHelp} chevron last />
          </Card>
        </View>

        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
          Skur has not been audited. Do not put real value behind it until an independent audit is
          complete.
        </Text>
      </View>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Field label="Full name">
            <Input value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          </Field>
          <Field label="Email address" hint="Stays on this device. Only used for notifications.">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
          <Button
            icon="check"
            disabled={!name.trim()}
            onPress={() => {
              saveProfile({ name: name.trim(), email: email.trim() });
              setEditing(false);
            }}
          >
            Save
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}
