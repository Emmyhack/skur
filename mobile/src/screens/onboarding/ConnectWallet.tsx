import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Role, templateById, tx as build } from '@skur/sdk';
import {
  Address,
  BackButton,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  TopBar,
  TxProgress,
} from '../../components/ui';
import { CheckItem } from '../../components/kit';
import { Icon } from '../../components/ui';
import { useTheme } from '../../state/theme';
import { F, R } from '../../theme';
import { client } from '../../lib/client';
import { NETWORK, PACKAGE_ID } from '../../lib/config';
import { biometricSupport, createSigner, importSigner, unlockSigner, type BiometricSupport } from '../../lib/keystore';
import { describeFailure } from '@skur/sdk';
import { hapticError, hapticSuccess } from '../../lib/haptics';
import { roleSpec } from '../../lib/roles';
import { useStore } from '../../state/store';
import type { OrgDraft } from './CreateOrg';
import type { MemberDraft } from './AddMembers';
import type { TxState } from '../../hooks/useTx';

/**
 * Screen 7 — the signer.
 *
 * The real wallet on a phone is the phone: an Ed25519 key in the secure element, released one
 * action at a time behind a biometric. The external wallets people know from the desktop are
 * listed so the choice is visible, and marked honestly until wallet-to-wallet connections ship.
 */
const EXTERNAL_WALLETS = ['Slush', 'Suiet', 'Backpack', 'Ledger', 'Nightly', 'OKX Wallet'] as const;

export function ConnectWallet({
  draft,
  members,
  onBack,
  onDone,
}: {
  /** Present when this run is creating an organisation; null when joining one. */
  draft: OrgDraft | null;
  members: MemberDraft[];
  onBack: () => void;
  onDone: () => void;
}) {
  usePreventScreenCapture();
  const C = useTheme();
  const { address, refreshSigner, openVault, saveProfile, profile } = useStore();
  const [bio, setBio] = useState<BiometricSupport | null>(null);
  const [importing, setImporting] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<TxState>({ phase: 'idle' });

  useEffect(() => {
    void biometricSupport().then(setBio);
  }, []);

  const makeKey = async (how: 'create' | 'import') => {
    setError(null);
    setBusy(true);
    try {
      if (how === 'create') await createSigner();
      else await importSigner(secret);
      await refreshSigner();
      setImporting(false);
      setSecret('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Build and execute the creation, and open the vault the chain hands back. */
  const createOrganisation = async () => {
    if (!draft || !address) return;
    setState({ phase: 'unlocking' });
    try {
      const keypair = await unlockSigner(`Create ${draft.name} on Sui`);
      setState({ phase: 'signing' });

      const template = templateById('startup');
      const roster = [
        { address, roles: Role.OWNER | Role.APPROVER | Role.EXECUTOR },
        ...members
          .filter((m) => roleSpec(m.role).bits !== 0)
          .map((m) => ({ address: m.address, roles: roleSpec(m.role).bits })),
      ];
      // The template assumes a team; the roster is what actually exists. Every threshold is
      // clamped to the people who can meet it — the contract refuses anything else, rightly: a
      // 2-of-1 vault is a locked box. Growing the team later raises these through governance.
      const owners = roster.filter((m) => m.roles & Role.OWNER).length;
      const approvers = roster.filter((m) => m.roles & Role.APPROVER).length;
      const guardians = roster.filter((m) => m.roles & Role.GUARDIAN).length;
      const policy = {
        ...template.policy,
        governanceThreshold: Math.min(template.policy.governanceThreshold, owners),
        approvalsLow: Math.min(template.policy.approvalsLow, approvers),
        approvalsHigh: Math.min(template.policy.approvalsHigh, approvers),
        approvalsCritical: Math.min(template.policy.approvalsCritical, approvers),
        guardianThreshold: Math.min(template.policy.guardianThreshold, Math.max(guardians, 1)),
        guardianRequiredCritical: template.policy.guardianRequiredCritical && guardians > 0,
      };
      const tx = build.createVault(PACKAGE_ID, {
        name: draft.name,
        policy,
        members: roster,
        assets: [{ coinType: '0x2::sui::SUI', limits: template.native }],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        include: { effects: true },
      });
      if (result.FailedTransaction) {
        throw new Error(result.FailedTransaction.status.error?.message ?? 'the network refused it');
      }
      const digest = result.Transaction.digest;
      setState({ phase: 'waiting', digest });
      await client.core.waitForTransaction({ digest });

      const created = (result.Transaction.effects?.changedObjects ?? []).find(
        (c) => c.outputOwner?.$kind === 'Shared' && c.idOperation === 'Created',
      );
      const vaultId = created && 'objectId' in created ? (created as { objectId: string }).objectId : null;
      if (!vaultId) throw new Error('the vault was created but its id could not be read — open it by id');

      hapticSuccess();
      setState({ phase: 'done', digest });
      if (profile) saveProfile(profile); // keep as-is; descriptions stay local
      openVault(vaultId);
      onDone();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (raw === 'cancelled') {
        setState({ phase: 'cancelled' });
        return;
      }
      hapticError();
      const funds = /gas|coin|balance|insufficient/i.test(raw);
      setState({
        phase: 'error',
        message: funds
          ? `This device's address has no SUI to pay for creation on ${NETWORK}. Fund it and try again.`
          : describeFailure(e),
      });
    }
  };

  const creating = state.phase === 'unlocking' || state.phase === 'signing' || state.phase === 'waiting';

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Connect Wallet" />}
      footer={
        address ? (
          <View style={{ gap: 10 }}>
            {state.phase !== 'idle' ? <TxProgress state={state} /> : null}
            {draft ? (
              <Button
                onPress={createOrganisation}
                disabled={creating}
                loading={creating}
                icon="check"
                testID="finish-setup"
              >
                Create {draft.name} on Sui
              </Button>
            ) : (
              <Button onPress={onDone} icon="arrow-right" testID="finish-setup">
                Continue
              </Button>
            )}
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: 18 }}>
        <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
          Choose a wallet to connect to Skur.
        </Text>

        {address ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="smartphone" size={18} color={C.success} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text, flex: 1 }}>This device</Text>
              <Badge tone="ok" icon="check">
                Connected
              </Badge>
            </View>
            <SectionLabel>Signs as</SectionLabel>
            <Address value={address} full />
          </Card>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Icon name="smartphone" size={18} color={C.text} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text, flex: 1 }}>
                This device (recommended)
              </Text>
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.text2, marginBottom: 12 }}>
              A new Ed25519 key, generated here and written to the secure element. It never leaves
              the phone and is released for one action at a time, behind{' '}
              {bio?.enrolled ? bio.label : 'your screen lock'}.
            </Text>
            {bio && !bio.enrolled ? (
              <Notice tone="warn">
                No {bio.available ? bio.label : 'screen lock'} is set up on this device. Set one up
                first — without it the key would sit unprotected.
              </Notice>
            ) : null}
            <View style={{ gap: 8, marginTop: 4 }}>
              <Button onPress={() => makeKey('create')} loading={busy} disabled={busy} icon="key" testID="create-key">
                Create a key on this device
              </Button>
              <Button kind="ghost" onPress={() => setImporting(true)} disabled={busy}>
                Import an existing key
              </Button>
            </View>
            {error ? <Notice tone="bad">{error}</Notice> : null}
          </Card>
        )}

        <View style={{ gap: 8 }}>
          <SectionLabel>External wallets</SectionLabel>
          <Card flush>
            {EXTERNAL_WALLETS.map((w, i) => (
              <Row
                key={w}
                leading={
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: R.sm,
                      backgroundColor: C.card2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text2 }}>{w[0]}</Text>
                  </View>
                }
                title={w}
                trailing={<Badge tone="neutral">Soon</Badge>}
                last={i === EXTERNAL_WALLETS.length - 1}
              />
            ))}
          </Card>
          <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
            Wallet-to-wallet connections are not wired up yet. The device key above is live today
            and holds the same roles any wallet would.
          </Text>
        </View>

        {!address ? (
          <Card>
            <CheckItem
              title="If you lose this device, the key is gone"
              detail="That is what guardian recovery is for: guardians can move your roles to a new key after a delay any owner can cancel."
              ok="warn"
              icon="info"
            />
          </Card>
        ) : null}

        <Text
          onPress={() => void Linking.openURL('mailto:support@skur.app')}
          accessibilityRole="link"
          style={{ fontFamily: F.bodyMedium, fontSize: 14, color: C.info, textAlign: 'center', paddingVertical: 6 }}
        >
          Need help?
        </Text>
      </View>

      <Sheet open={importing} onClose={() => setImporting(false)} title="Import a key">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Field label="Secret key" hint="A suiprivkey… string. Validated before it is stored.">
            <Input
              mono
              value={secret}
              onChangeText={setSecret}
              placeholder="suiprivkey…"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </Field>
          <Button onPress={() => makeKey('import')} disabled={!secret.trim() || busy} loading={busy} icon="download">
            Import
          </Button>
          {error ? <Notice tone="bad">{error}</Notice> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
