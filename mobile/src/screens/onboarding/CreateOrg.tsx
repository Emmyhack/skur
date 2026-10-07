import { useState } from 'react';
import { Text, View } from 'react-native';
import { BackButton, Button, Card, Field, Input, KV, Screen, SectionLabel, TopBar } from '../../components/ui';
import { useTheme } from '../../state/theme';
import { F } from '../../theme';
import { NETWORK } from '../../lib/config';

export type OrgDraft = { name: string; description: string };

/**
 * Screen 5 — name the organisation. The blockchain row is fixed by the build: which Sui network
 * this app points at is an environment decision, not something to mis-tap during setup.
 */
export function CreateOrg({
  draft,
  onBack,
  onDone,
}: {
  draft: OrgDraft | null;
  onBack: () => void;
  onDone: (draft: OrgDraft) => void;
}) {
  const C = useTheme();
  const [name, setName] = useState(draft?.name ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const ready = name.trim().length >= 2;

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={onBack} />} title="Create Organisation" />}
      footer={
        <Button
          onPress={() => onDone({ name: name.trim(), description: description.trim() })}
          disabled={!ready}
          icon="arrow-right"
          testID="org-continue"
        >
          Continue
        </Button>
      }
    >
      <View style={{ gap: 18 }}>
        <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.text2 }}>
          Set up your team or business on Skur.
        </Text>

        <Field label="Organisation name">
          <Input value={name} onChangeText={setName} placeholder="Lenzypay Treasury" maxLength={48} />
        </Field>

        <Field label="Description (optional)" hint="Stays on this device — the chain stores the name only.">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Main company treasury for payments and operations."
            maxLength={120}
          />
        </Field>

        <View style={{ gap: 8 }}>
          <SectionLabel>Blockchain</SectionLabel>
          <Card>
            <KV k="Network" v={`Sui (${NETWORK})`} last />
          </Card>
        </View>
      </View>
    </Screen>
  );
}
