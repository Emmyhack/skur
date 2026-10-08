import { Text, View } from 'react-native';
import { fmtAmount } from '@skur/sdk';
import { Address, Card, Empty, Notice, Row, Screen, SectionLabel, TopBar } from '../components/ui';
import { TokenMark, coinDecimals, coinSymbol } from '../components/TokenMark';
import { Identicon } from '../components/Identicon';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

export function Receive() {
  const C = useTheme();
  const { vaultId } = useStore();
  const q = useVaultView(vaultId);

  return (
    <Screen top={<TopBar title="Receive" />}>
      <View style={{ gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 12 }}>
          <Identicon address={vaultId ?? '0x0'} size={72} />
          <Text style={{ fontFamily: F.display, fontSize: 20, color: C.text }}>
            {q.data?.vault.name ?? 'Treasury'}
          </Text>
        </View>

        <Card>
          <SectionLabel>Vault address</SectionLabel>
          <Address value={vaultId ?? ''} full />
        </Card>

        <Notice tone="info">
          Deposits are never gated — in any mode, from any address. The controls exist to govern
          money leaving; refusing money arriving would only strand it.
        </Notice>

        <View style={{ gap: 8 }}>
          <SectionLabel>Assets this vault accepts</SectionLabel>
          {(q.data?.assets ?? []).filter((a) => a.limits.approved).length === 0 ? (
            <Empty icon="inbox">No asset is approved yet.</Empty>
          ) : (
            <Card flush>
              {q.data!.assets
                .filter((a) => a.limits.approved)
                .map((a, i, arr) => (
                  <Row
                    key={a.coinType}
                    leading={<TokenMark coinType={a.coinType} />}
                    title={coinSymbol(a.coinType)}
                    subtitle={`holding ${fmtAmount(a.balance, coinDecimals(a.coinType))}`}
                    last={i === arr.length - 1}
                  />
                ))}
            </Card>
          )}
        </View>

        <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text3 }}>
          Sending a coin type this vault has not approved will fail. Approving one is a governance
          action.
        </Text>
      </View>
    </Screen>
  );
}
