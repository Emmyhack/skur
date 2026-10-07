import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  BackButton,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Notice,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  TopBar,
} from '../../components/ui';
import { Avatar } from '../../components/kit';
import { Identicon } from '../../components/Identicon';
import { short } from '@skur/sdk';
import { ROLE_SPECS, roleSpec, type RoleId } from '../../lib/roles';
import { useTheme } from '../../state/theme';
import { F } from '../../theme';
import { useStore } from '../../state/store';

export type MemberDraft = { address: string; role: RoleId };

const ADDRESS = /^0x[0-9a-fA-F]{64}$/;

/**
 * Screen 6 — the roster. You are the first owner; everyone else is an address and a role. The
 * contract writes this at creation, so what is promised here is exactly what will hold.
 */
export function AddMembers({
  members,
  onBack,
  onDone,
}: {
  members: MemberDraft[];
  onBack: () => void;
  onDone: (members: MemberDraft[]) => void;
}) {
  const C = useTheme();
  const { profile } = useStore();
  const [list, setList] = useState<MemberDraft[]>(members);
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<RoleId>('signer');

  const trimmed = address.trim();
  const valid = ADDRESS.test(trimmed);
  const duplicate = list.some((m) => m.address.toLowerCase() === trimmed.toLowerCase());
  const guardians = list.filter((m) => m.role === 'guardian').length;

  const add = () => {
    setList([...list, { address: trimmed, role }]);
    setAddress('');
    setRole('signer');
    setAdding(false);
  };

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Add Members" />}
      footer={
        <Button onPress={() => onDone(list)} icon="arrow-right" testID="members-continue">
          Continue
        </Button>
      }
    >
      <View style={{ gap: 18 }}>
        <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
          Invite your team members and set their roles.
        </Text>

        <Card flush>
          <Row
            leading={<Avatar name={profile?.name ?? 'You'} />}
            title={`${profile?.name ?? 'You'} (You)`}
            subtitle="Key created in the next step"
            trailing={<Badge tone="warn">Owner</Badge>}
            last={list.length === 0}
          />
          {list.map((m, i) => (
            <Row
              key={m.address}
              leading={<Identicon address={m.address} size={36} />}
              title={short(m.address)}
              subtitle={roleSpec(m.role).grants}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge tone={m.role === 'guardian' ? 'info' : 'neutral'}>{roleSpec(m.role).title}</Badge>
                  <IconButton
                    name="x"
                    label={`Remove ${short(m.address)}`}
                    onPress={() => setList(list.filter((x) => x.address !== m.address))}
                  />
                </View>
              }
              last={i === list.length - 1}
            />
          ))}
        </Card>

        <Button kind="secondary" icon="plus" onPress={() => setAdding(true)} testID="add-member">
          Add Member
        </Button>

        {guardians === 0 ? (
          <Notice tone="warn">
            No guardian yet. A guardian is an independent key that can veto a theft in progress —
            without one, the vault is only as safe as its signers. You can also add one later
            through governance.
          </Notice>
        ) : null}

        <Text style={{ fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.text3 }}>
          Members are written on chain at creation. Viewers need no role — a vault is a shared
          object anyone can read.
        </Text>
      </View>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a member">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Field label="Sui address">
            <Input
              mono
              value={address}
              onChangeText={setAddress}
              placeholder="0x…"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <View style={{ gap: 8 }}>
            <SectionLabel>Role</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {ROLE_SPECS.filter((r) => r.id !== 'viewer' && r.id !== 'owner').map((r) => (
                <Button
                  key={r.id}
                  size="sm"
                  kind={role === r.id ? 'primary' : 'secondary'}
                  onPress={() => setRole(r.id)}
                >
                  {r.title}
                </Button>
              ))}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2 }}>
              {roleSpec(role).grants}
            </Text>
          </View>
          {duplicate ? <Notice tone="warn">That address is already on the roster.</Notice> : null}
          <Button onPress={add} disabled={!valid || duplicate} icon="check" testID="confirm-member">
            Add to roster
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}
