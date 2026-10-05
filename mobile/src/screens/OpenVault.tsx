import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MODE_LABELS, describeRoles } from '@skur/sdk';
import { Address, Button, Card, Empty, Field, Input, Notice, Row, Screen, SectionLabel, TopBar } from '../components/ui';
import { Identicon } from '../components/Identicon';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { API_URL, CONFIGURED, NETWORK } from '../lib/config';
import { useStore } from '../state/store';

/** Vaults the device's key holds a role in, via the indexer when one is configured. */
function useMyVaults(address: string | null) {
  return useQuery<{ vault_id: string; name: string; roles: number; mode: number }[]>({
    queryKey: ['my-vaults', NETWORK, address],
    enabled: Boolean(address && API_URL),
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/members/${address}/vaults`);
      if (!res.ok) throw new Error(`the indexer returned ${res.status}`);
      return (await res.json()).vaults;
    },
  });
}

export function OpenVault() {
  const C = useTheme();
  const { address, openVault } = useStore();
  const [manual, setManual] = useState('');
  const mine = useMyVaults(address);
  const valid = /^0x[0-9a-fA-F]{10,66}$/.test(manual);

  return (
    <Screen
      top={<TopBar title="Open a vault" />}
      refreshControl={<RefreshControl refreshing={mine.isFetching} onRefresh={() => mine.refetch()} tintColor={C.text2} />}
    >
      <View style={{ gap: 20 }}>
        {!CONFIGURED ? (
          <Notice tone="warn">
            No package is configured for {NETWORK}. Publish the Move package and set
            EXPO_PUBLIC_SKUR_PACKAGE_ID.
          </Notice>
        ) : null}

        <View style={{ gap: 8 }}>
          <SectionLabel>Yours</SectionLabel>
          {!API_URL ? (
            <Card>
              <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
                Finding your vaults by address needs the indexer. Set EXPO_PUBLIC_SKUR_API, or open
                a vault by its id below — reading one needs nothing but the chain.
              </Text>
            </Card>
          ) : mine.isLoading ? (
            <Card><Text style={{ fontFamily: F.body, color: C.text2 }}>Looking…</Text></Card>
          ) : mine.error ? (
            <Notice tone="warn">The indexer is not reachable. You can still open a vault by id.</Notice>
          ) : mine.data && mine.data.length > 0 ? (
            <Card flush>
              {mine.data.map((v, i) => (
                <Row
                  key={v.vault_id}
                  leading={<Identicon address={v.vault_id} size={36} />}
                  title={v.name}
                  subtitle={`${describeRoles(v.roles).join(' · ') || 'no role'} · ${MODE_LABELS[v.mode as 0 | 1 | 2]}`}
                  onPress={() => openVault(v.vault_id)}
                  chevron
                  last={i === mine.data!.length - 1}
                />
              ))}
            </Card>
          ) : (
            <Empty icon="inbox">
              No vault on {NETWORK} lists this device&apos;s key as a signer yet.
              {address ? '\n\nSend your address to an owner so they can add it.' : ''}
            </Empty>
          )}
        </View>

        {address ? (
          <Card>
            <SectionLabel>This device signs as</SectionLabel>
            <Address value={address} full />
          </Card>
        ) : null}

        <View style={{ gap: 12 }}>
          <SectionLabel>By id</SectionLabel>
          <Field label="Vault object id" hint="A vault is a shared object. Anyone can read one.">
            <Input mono value={manual} onChangeText={setManual} placeholder="0x…" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Button onPress={() => openVault(manual)} disabled={!valid} icon="arrow-right">
            Open
          </Button>
        </View>
      </View>
    </Screen>
  );
}
