import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Trust,
  canPropose,
  describeReasons,
  fmtAmount,
  fmtDuration,
  parseAmount,
  tx as build,
} from '@skur/sdk';
import {
  Address,
  Button,
  Card,
  Field,
  Input,
  KV,
  Notice,
  Screen,
  SectionLabel,
  TierBadge,
  TopBar,
  TrustBadge,
  TxStatus,
} from '../components/ui';
import { normalizeAmount } from '../lib/amount';
import { Segmented } from '../components/kit';
import { ScanSheet } from '../components/Scan';
import { IconButton } from '../components/ui';
import { coinDecimals, coinSymbol } from '../components/TokenMark';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { PACKAGE_ID } from '../lib/config';
import { useTransferPreview, useVaultView } from '../hooks/useVault';
import { useTx } from '../hooks/useTx';
import { useStore } from '../state/store';

/**
 * Opening a payment.
 *
 * The review is the vault's own classification, simulated live. The phone does not compute it, so
 * it cannot promise something the vault would refuse — which is the point of `preview_transfer`
 * being the same code `execute_transfer` runs.
 */
export function Send({ onDone }: { onDone: () => void }) {
  const C = useTheme();
  const { vaultId, address, book } = useStore();
  const q = useVaultView(vaultId);
  const tx = useTx(vaultId);

  const approved = (q.data?.assets ?? []).filter((a) => a.limits.approved);
  const [direction, setDirection] = useState<'send' | 'request'>('send');
  const [coinType, setCoinType] = useState<string>('');
  const [to, setTo] = useState('');
  const [amountText, setAmountText] = useState('');
  const [memo, setMemo] = useState('');
  const [scanning, setScanning] = useState(false);

  const asset = approved.find((a) => a.coinType === coinType) ?? approved[0];
  const activeType = asset?.coinType ?? '';
  const decimals = activeType ? coinDecimals(activeType) : 9;
  const amount = useMemo(() => parseAmount(normalizeAmount(amountText), decimals) ?? 0n, [amountText, decimals]);
  const validTo = /^0x[0-9a-fA-F]{1,64}$/.test(to);

  const known = q.data?.recipients.find((r) => r.address === to);
  const labelled = book.find((b) => b.address === to);
  const roles = address ? (q.data?.members.find((m) => m.address === address)?.roles ?? 0) : 0;

  const preview = useTransferPreview({
    vaultId,
    coinType: activeType,
    amount,
    recipient: to,
    sender: address,
    enabled: Boolean(activeType) && validTo && amount > 0n,
  });

  // Mirrors what `propose_transfer` would refuse, so the form says why before a prompt appears.
  const problems: string[] = [];
  if (asset && amount > 0n) {
    if ((known?.trust ?? Trust.UNKNOWN) === Trust.BLOCKED) problems.push('This recipient is blocked.');
    if (asset.limits.perTxMax !== 0n && amount > asset.limits.perTxMax)
      problems.push(`Above the per-payment cap of ${fmtAmount(asset.limits.perTxMax, decimals)}.`);
    const spent = asset.velocity?.daySpent ?? 0n;
    if (asset.limits.dailyMax !== 0n && spent + amount > asset.limits.dailyMax)
      problems.push(`Above what is left of today (${fmtAmount(asset.limits.dailyMax - spent, decimals)}).`);
    if (amount > asset.balance) problems.push(`The vault holds ${fmtAmount(asset.balance, decimals)}.`);
  }

  const mayPropose = canPropose(roles);
  const ready = mayPropose && validTo && amount > 0n && problems.length === 0 && Boolean(activeType);

  if (approved.length === 0) {
    return (
      <Screen top={<TopBar title="New Transaction" />}>
        <Notice tone="warn">
          No asset is approved for this vault yet. An owner has to approve one through governance
          before anything can be paid.
        </Notice>
      </Screen>
    );
  }

  if (direction === 'request') {
    return (
      <Screen top={<TopBar title="New Transaction" />}>
        <View style={{ gap: 16 }}>
          <Segmented
            value={direction}
            options={[
              ['send', 'Send'],
              ['request', 'Request'],
            ]}
            onChange={setDirection}
          />
          <Notice tone="info">
            Deposits are never gated — in any mode, from any address. Share this vault's address
            and the funds land directly on it.
          </Notice>
          <Card>
            <SectionLabel>Vault address</SectionLabel>
            <Address value={vaultId ?? ''} full />
          </Card>
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text3 }}>
            Sending a coin type this vault has not approved will fail. Approving one is a
            governance action.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      top={<TopBar title="New Transaction" />}
      footer={
        <View style={{ gap: 10 }}>
          <TxStatus state={tx.state} />
          <Button
            onPress={() =>
              tx
                .run(
                  () =>
                    build.proposeTransfer(PACKAGE_ID, {
                      vaultId: vaultId!,
                      coinType: activeType,
                      amount,
                      recipient: to,
                      memo,
                    }),
                  'Open this payment for approval',
                )
                .then((d) => {
                  if (d) {
                    setAmountText('');
                    setMemo('');
                    onDone();
                  }
                })
            }
            disabled={!ready || tx.busy}
            loading={tx.busy}
            icon="arrow-up-right"
          >
            Open for approval
          </Button>
        </View>
      }
    >
      <View style={{ gap: 18 }}>
        <Segmented
          value={direction}
          options={[
            ['send', 'Send'],
            ['request', 'Request'],
          ]}
          onChange={setDirection}
        />
        <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
          Opening a payment is not approving it. The vault scores it first and then says what it
          needs.
        </Text>

        {approved.length > 1 ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Asset</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {approved.map((a) => (
                <Button
                  key={a.coinType}
                  size="sm"
                  kind={a.coinType === activeType ? 'primary' : 'secondary'}
                  onPress={() => setCoinType(a.coinType)}
                >
                  {coinSymbol(a.coinType)}
                </Button>
              ))}
            </View>
          </View>
        ) : null}

        <Field label="Recipient" hint={labelled ? labelled.label : undefined}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input mono value={to} onChangeText={(t) => setTo(t.trim())} placeholder="0x…" autoCapitalize="none" autoCorrect={false} />
            </View>
            <IconButton name="maximize" label="Scan an address QR" onPress={() => setScanning(true)} />
          </View>
        </Field>
        {validTo ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <TrustBadge trust={known?.trust ?? Trust.UNKNOWN} />
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3 }}>
              {known && known.paidCount > 0
                ? `paid ${known.paidCount} time${known.paidCount === 1 ? '' : 's'} before`
                : 'never paid by this vault'}
            </Text>
          </View>
        ) : null}

        <Field
          label="Amount"
          hint={asset ? `Routine up to ${fmtAmount(asset.limits.lowMax, decimals)} ${coinSymbol(activeType)}` : undefined}
        >
          <Input big mono value={amountText} onChangeText={setAmountText} placeholder="0.00" keyboardType="decimal-pad" />
        </Field>

        {amount > 0n ? (
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.text3, marginTop: -10 }}>
            = {amount.toString()} base units
          </Text>
        ) : null}

        <Field label="Purpose (optional)">
          <Input value={memo} onChangeText={setMemo} placeholder="What this is for" maxLength={120} />
        </Field>

        {!mayPropose ? (
          <Notice tone="warn">
            This device&apos;s key cannot open payments in this vault. That takes an owner,
            approver, executor or proposer role.
          </Notice>
        ) : null}

        {problems.length > 0 ? (
          <Notice tone="bad">{`The vault would refuse this. ${problems.join(' ')}`}</Notice>
        ) : null}

        {preview.data ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <SectionLabel>What the vault will demand</SectionLabel>
              <TierBadge tier={preview.data.tier} />
            </View>
            <KV k="Approvals" v={String(preview.data.reqApprovals)} />
            <KV k="Guardian" v={preview.data.reqGuardians === 0 ? 'none' : String(preview.data.reqGuardians)} />
            <KV k="Waits" v={preview.data.delay === 0 ? 'no wait' : fmtDuration(preview.data.delay)} />
            <KV k="Share of this asset" v={`${(preview.data.exposureBps / 100).toFixed(2)}%`} last />
            {describeReasons(preview.data.reasons).length > 0 ? (
              <View style={{ marginTop: 10, gap: 2 }}>
                {describeReasons(preview.data.reasons).map((r) => (
                  <Text key={r} style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text2 }}>
                    • {r}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        ) : preview.isLoading ? (
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text3 }}>Asking the vault…</Text>
        ) : null}
      </View>

      <ScanSheet open={scanning} onClose={() => setScanning(false)} onAddress={setTo} />
    </Screen>
  );
}
