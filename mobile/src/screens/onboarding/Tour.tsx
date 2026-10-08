import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Screen } from '../../components/ui';
import { CheckItem, Dots } from '../../components/kit';
import { useTheme } from '../../state/theme';
import { F } from '../../theme';

/**
 * Screen 2 — what the product does, in four controls. One page of checks plus two pages of
 * depth, so "Next" has somewhere to go and the dots are not decoration.
 */
const PAGES: { heading: string; sub: string; items: [string, string][] }[] = [
  {
    heading: 'Your Treasury,\nUnder Control.',
    sub: 'Four controls stand between a stolen key and your money.',
    items: [
      ['Multi-Signature Security', 'Require multiple approvals'],
      ['Spending Policies', 'Set limits and rules'],
      ['Transaction Simulation', 'Check before you sign'],
      ['Team Permissions', 'Manage roles and access'],
    ],
  },
  {
    heading: 'Approvals that\nfollow the risk.',
    sub: 'The amount, the destination and today’s outflow decide how much sign-off a payment needs.',
    items: [
      ['Risk-tiered approvals', 'Routine, high and critical each demand their own quorum'],
      ['Timelocks on big moves', 'Critical payments wait, so a theft can be vetoed'],
      ['A loss envelope', 'A hard ceiling on what can leave in a day'],
    ],
  },
  {
    heading: 'Enforced on chain,\nnot promised.',
    sub: 'Every rule lives in a Move object anyone can read. The app cannot bend them, and neither can an attacker with one key.',
    items: [
      ['Guardians', 'An independent brake that can veto or freeze'],
      ['Key on your phone', 'In the secure element, behind your fingerprint or face'],
      ['Recovery built in', 'Lose the phone, keep the treasury'],
    ],
  },
];

export function Tour({ onDone }: { onDone: () => void }) {
  const C = useTheme();
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  const last = page === PAGES.length - 1;
  return (
    <Screen
      footer={
        <View style={{ gap: 14 }}>
          <Dots count={PAGES.length} index={page} />
          <Button onPress={() => (last ? onDone() : setPage(page + 1))} icon="arrow-right" testID="tour-next">
            {last ? 'Continue' : 'Next'}
          </Button>
        </View>
      }
    >
      <View style={{ gap: 20, paddingTop: 24 }}>
        <Text style={{ fontFamily: F.display, fontSize: 32, lineHeight: 38, color: C.text }}>{p.heading}</Text>
        <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text2 }}>{p.sub}</Text>
        <Card>
          {p.items.map(([title, detail]) => (
            <CheckItem key={title} title={title} detail={detail} />
          ))}
        </Card>
      </View>
    </Screen>
  );
}
