import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { Role, hasRole, short, tx as build } from '@skur/sdk';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  IconButton,
  Input,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  TopBar,
  TxStatus,
} from '../components/ui';
import { Identicon } from '../components/Identicon';
import { ROLE_SPECS, roleSpec, titleForBits, type RoleId } from '../lib/roles';
import { useTheme } from '../state/theme';
import { F } from '../theme';
import { PACKAGE_ID } from '../lib/config';
import { useTx } from '../hooks/useTx';
import { useVaultView } from '../hooks/useVault';
import { useStore } from '../state/store';

const ADDRESS = /^0x[0-9a-fA-F]{64}$/;

/**
 * Screen 15 — the team. The roster is the chain's, not a local list, and an invitation is a
 * governance proposal: it collects owner approvals like any other change to who can move money.
 */
export function Team({ onOpenRoles }: { onOpenRoles: () => void }) {
  const C = useTheme();
  const { vaultId, address, profile } = useStore();
  const q = useVaultView(vaultId);
  const tx = useTx(vaultId);

  const [inviting, setInviting] = useState(false);
  const [invitee, setInvitee] = useState('');
  const [role, setRole] = useState<RoleId>('signer');

  const myRoles = address ? (q.data?.members.find((m) => m.address === address)?.roles ?? 0) : 0;
  const isOwner = hasRole(myRoles, Role.OWNER);
  const trimmed = invitee.trim();
  const valid = ADDRESS.test(trimmed);
  const already = q.data?.members.some((m) => m.address.toLowerCase() === trimmed.toLowerCase()) ?? false;

  if (q.isLoading) {
    return (
      <Screen top={<TopBar title="Team" />}>
        <Skeleton lines={4} />
      </Screen>
    );
  }
  if (!q.data) {
    return (
      <Screen top={<TopBar title="Team" />}>
        <ErrorState onRetry={() => q.refetch()} />
      </Screen>
    );
  }

  const members = q.data.members;

  return (
    <Screen
      top={
        <TopBar
          title="Team"
          right={<IconButton name="award" label="Roles and permissions" onPress={onOpenRoles} />}
        />
      }
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.text2} />}
      footer={
        isOwner ? (
          <View style={{ gap: 10 }}>
            <TxStatus state={tx.state} />
            <Button icon="user-plus" onPress={() => setInviting(true)} testID="invite-member">
              Invite Member
            </Button>
          </View>
        ) : null
      }
    >
      <View style={{ gap: 16 }}>
        <SectionLabel>
          {members.length} member{members.length === 1 ? '' : 's'}
        </SectionLabel>
        <Card flush>
          {members.map((m, i) => {
            const me = m.address === address;
            const title = titleForBits(m.roles);
            return (
              <Row
                key={m.address}
                leading={<Identicon address={m.address} size={36} />}
                title={me && profile?.name ? `${profile.name} (You)` : me ? `${short(m.address)} (You)` : short(m.address)}
                subtitle={me ? undefined : short(m.address) === m.address ? undefined : undefined}
                trailing={
                  <Badge tone={title === 'Guardian' ? 'info' : title === 'Owner' ? 'warn' : 'neutral'}>{title}</Badge>
                }
                last={i === members.length - 1}
              />
            );
          })}
        </Card>

        <Card flush>
          <Row
            title="Roles & Permissions"
            subtitle="What each role may do, and why guardians stand apart"
            onPress={onOpenRoles}
            chevron
            last
          />
        </Card>

        {!isOwner ? (
          <Notice tone="info">
            Changing the roster takes an owner. Membership is a governance action, approved like any
            other change to who can move money.
          </Notice>
        ) : (
          <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
            An invitation opens a proposal. It executes once {q.data.vault.policy.governanceThreshold} owner
            {q.data.vault.policy.governanceThreshold === 1 ? ' has' : 's have'} approved it.
          </Text>
        )}
      </View>

      <Sheet open={inviting} onClose={() => setInviting(false)} title="Invite a member">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Field label="Sui address">
            <Input mono value={invitee} onChangeText={setInvitee} placeholder="0x…" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <View style={{ gap: 8 }}>
            <SectionLabel>Role</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {ROLE_SPECS.filter((r) => r.id !== 'viewer').map((r) => (
                <Button key={r.id} size="sm" kind={role === r.id ? 'primary' : 'secondary'} onPress={() => setRole(r.id)}>
                  {r.title}
                </Button>
              ))}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2 }}>
              {roleSpec(role).grants}
            </Text>
          </View>
          {already ? <Notice tone="warn">That address is already a member.</Notice> : null}
          <Button
            icon="user-plus"
            disabled={!valid || already || tx.busy}
            loading={tx.busy}
            onPress={() =>
              tx
                .run(
                  () =>
                    build.proposeMember(PACKAGE_ID, {
                      vaultId: vaultId!,
                      member: trimmed,
                      roles: roleSpec(role).bits,
                    }),
                  `Invite ${short(trimmed)} as ${roleSpec(role).title}`,
                )
                .then((d) => {
                  if (d) {
                    setInvitee('');
                    setInviting(false);
                  }
                })
            }
          >
            Open the invitation
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}
