import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DARK, F, R } from '../theme';

/**
 * The last line. Without this, an uncaught render error is a white screen — no message, no way
 * back, and on a treasury app a person staring at it not knowing whether their payment went
 * through.
 *
 * It is a class component because error boundaries still have to be, it uses hard-coded dark
 * palette values because the theme provider may be the thing that crashed, and it says what a
 * person needs to hear first: nothing was signed by this crash. Signing only happens behind an
 * explicit biometric prompt, so a render error cannot have moved money.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; key: number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // The one place a stack is deliberately logged. Nothing sensitive renders into component
    // stacks — keys never enter the React tree — and without this line a field crash is unfixable.
    console.error('[skur] render crash:', error.message, info.componentStack ?? '');
  }

  render() {
    if (!this.state.error) {
      // The key remounts the whole subtree on restart, clearing whatever state crashed it.
      return <View key={this.state.key} style={{ flex: 1 }}>{this.props.children}</View>;
    }
    return (
      <View style={{ flex: 1, backgroundColor: DARK.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <Text style={{ fontFamily: F.display, fontSize: 22, color: DARK.text, textAlign: 'center' }}>
          Something broke in the app
        </Text>
        <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: DARK.text2, textAlign: 'center' }}>
          Nothing was signed — signing only ever happens behind a biometric prompt you can see. The
          vault and your key are unaffected.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: DARK.text3, textAlign: 'center' }} numberOfLines={3}>
          {this.state.error.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState((s) => ({ error: null, key: s.key + 1 }))}
          style={{ marginTop: 8, backgroundColor: DARK.accent, borderRadius: R.md, paddingVertical: 13, paddingHorizontal: 28 }}
        >
          <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: DARK.onAccent }}>Restart</Text>
        </Pressable>
      </View>
    );
  }
}
