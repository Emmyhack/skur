import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Address, Button, Card, KV, Notice, Row, Screen, SectionLabel, Tabs, TopBar } from '../components/ui';
import { useScheme, type Scheme } from '../state/theme';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { API_URL, NETWORK, PACKAGE_ID, explorer } from '../lib/config';
import { biometricSupport, forgetSigner, type BiometricSupport } from '../lib/keystore';
import { useStore } from '../state/store';

export function Settings() {
  const C = useTheme();
  const { scheme, setScheme } = useScheme();
  const { address, vaultId, closeVault, refreshSigner } = useStore();
  const [bio, setBio] = useState<BiometricSupport | null>(null);

  useEffect(() => {
    void biometricSupport().then(setBio);
  }, []);

  const forget = () =>
    Alert.alert(
      'Forget this key?',
      'The key is deleted from this device and cannot be recovered. Your address stays a member of the vault until governance removes it — guardians can move your roles to a new key, which is what recovery is for.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget it',
          style: 'destructive',
          onPress: () => {
            void forgetSigner().then(refreshSigner);
          },
        },
      ],
    );

  return (
    <Screen top={<TopBar title="Settings" />}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <SectionLabel>Appearance</SectionLabel>
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
          <SectionLabel>This device</SectionLabel>
          <Card>
            {address ? (
              <>
                <SectionLabel>Signs as</SectionLabel>
                <Address value={address} full />
                <View style={{ marginTop: 10 }}>
                  <KV
                    k="Unlocked with"
                    v={bio ? (bio.enrolled ? bio.label : 'no screen lock set') : '…'}
                    last
                  />
                </View>
              </>
            ) : (
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.text2 }}>
                No signing key on this device.
              </Text>
            )}
          </Card>
          <Notice tone="warn">
            This is a hot key: appropriate for an approver or an executor, whose authority is
            bounded by the policy. A guardian key belongs somewhere this phone is not.
          </Notice>
          {address ? (
            <Button kind="danger" icon="trash-2" onPress={forget}>
              Forget this key
            </Button>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>Network</SectionLabel>
          <Card>
            <KV k="Chain" v={`Sui ${NETWORK}`} />
            <KV k="Package" v={PACKAGE_ID === '0x0' ? 'not configured' : `${PACKAGE_ID.slice(0, 10)}…`} mono />
            <KV k="Indexer" v={API_URL || 'not configured — reads go straight to the chain'} last />
          </Card>
        </View>

        {vaultId ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Vault</SectionLabel>
            <Card flush>
              <Row title="On the explorer" subtitle={explorer('object', vaultId)} chevron last={false} />
              <Row title="Close this vault" subtitle="Keeps the key; just stops showing it" onPress={closeVault} last />
            </Card>
          </View>
        ) : null}

        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
          Skur has not been audited. Do not put real value behind it until an independent audit is
          complete.
        </Text>
      </View>
    </Screen>
  );
}
