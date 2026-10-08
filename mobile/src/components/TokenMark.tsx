import { Text, View } from 'react-native';
import { useTheme } from '../state/theme';
import { F } from '../theme';

/** A coin type's struct name is what a person recognises; the rest is address noise. */
export function coinSymbol(coinType: string): string {
  return (coinType.split('::').pop() ?? coinType).toUpperCase();
}

const DECIMALS: Record<string, number> = { SUI: 9, USDC: 6, USDT: 6, USDSUI: 6 };

export function coinDecimals(coinType: string): number {
  return DECIMALS[coinSymbol(coinType)] ?? 9;
}

/** Deterministic colour per symbol, so the same asset looks the same on every screen. */
const TINTS: [string, string][] = [
  ['#4da2ff', '#0b1f36'],
  ['#2775ca', '#06182e'],
  ['#26a17b', '#05261c'],
  ['#8b5cf6', '#1b0f33'],
];

export function TokenMark({ coinType, size = 32 }: { coinType: string; size?: number }) {
  const C = useTheme();
  const symbol = coinSymbol(coinType);
  let n = 0;
  for (let i = 0; i < symbol.length; i++) n = (n + symbol.charCodeAt(i)) % TINTS.length;
  const [bg, fg] = TINTS[n];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
      }}
    >
      <Text style={{ fontFamily: F.bodyBold, fontSize: size * 0.34, color: fg === '#fff' ? fg : '#fff' }}>
        {symbol.slice(0, 2)}
      </Text>
    </View>
  );
}
