import { useMemo } from "react";
import { Text, View } from "react-native";
import { keccak256, stringToHex } from "viem";
import { C, F } from "../theme";

/** Same deterministic blocky avatar as the web interface (web/src/components/Identicon.tsx), drawn with views. */
export function Identicon({ address, size = 40, badge }: { address: string; size?: number; badge?: string }) {
  const { cells, fg, bg } = useMemo(() => {
    const hash = keccak256(stringToHex(address.toLowerCase())).slice(2);
    const hue = parseInt(hash.slice(0, 4), 16) % 360;
    const hue2 = (hue + 140) % 360;
    const bits = hash.slice(4);
    const cells: boolean[] = [];
    for (let y = 0; y < 5; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < 3; x++) row.push(parseInt(bits[(y * 3 + x) % bits.length], 16) % 3 !== 0);
      cells.push(row[0], row[1], row[2], row[1], row[0]);
    }
    return { cells, fg: `hsl(${hue}, 70%, 45%)`, bg: `hsl(${hue2}, 60%, 88%)` };
  }, [address]);
  const unit = size / 5;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: bg, flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((on, i) => <View key={i} style={{ width: unit, height: unit, backgroundColor: on ? fg : "transparent" }} />)}
      </View>
      {badge ? (
        <View style={{ position: "absolute", right: -4, top: -4, backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 5, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.canvas }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 10, color: C.onAccent }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}
