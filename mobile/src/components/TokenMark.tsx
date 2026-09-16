import { Text, View } from "react-native";
import { tokenMark } from "@web/lib/tokens";
import { F } from "../theme";

/** The asset's mark: one colour and glyph per symbol, the same in both interfaces. */
export function TokenMark({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const m = tokenMark(symbol);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: m.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.46, color: m.fg, lineHeight: size * 0.62 }}>{m.glyph}</Text>
    </View>
  );
}
