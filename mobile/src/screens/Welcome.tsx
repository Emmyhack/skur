import { useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StatusBar, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Identicon } from "../components/Identicon";
import { Icon } from "../components/ui";
import { C, F } from "../theme";

const W = Dimensions.get("window").width;
const ART = 310;
/** Light palette for the first-launch screens, matching the web's marketing pages. */
const L = { bg: "#ffffff", ink: "#212529", ink2: "#6c757d", line: "#e9ecef", wash: "#f1f3f5" };
const shadow = { shadowColor: "#0b1220", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 } as const;

const PAGES = [
  { title: "Track your treasury.\nAnywhere.", sub: "Balances and activity, read live from the chain.", art: <ArtVault /> },
  { title: "Every payment,\nscored first.", sub: "Approvals, delay and veto, set by the vault.", art: <ArtTiers /> },
  { title: "Sign the moment\nyou're needed.", sub: "Face ID to sign. The vault checks the policy.", art: <ArtSign /> },
];

/** First launch: one idea per page, a real product surface as its illustration, and a single button. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  return (
    <View style={{ flex: 1, backgroundColor: L.bg, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 18) }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 18, color: C.onAccent }}>S</Text></View>
        <Text style={{ fontFamily: F.display, fontSize: 27, color: L.ink, letterSpacing: -0.6 }}>Skur</Text>
        <Text style={{ fontFamily: F.displayMedium, fontSize: 25, color: L.ink2, letterSpacing: -0.4 }}>{"[MOBILE]"}</Text>
      </View>

      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flexGrow: 0 }}>
        {PAGES.map((p, i) => (
          <View key={i} style={{ width: W, paddingHorizontal: 26 }}>
            <View style={{ height: ART, alignItems: "center", justifyContent: "center", marginTop: 14 }}>{p.art}</View>
            <Text style={{ fontFamily: F.display, fontSize: 38, lineHeight: 43, color: L.ink, textAlign: "center", letterSpacing: -1.1, marginTop: 34 }}>{p.title}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 23, color: L.ink2, textAlign: "center", marginTop: 14 }}>{p.sub}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 }}>
        {PAGES.map((_, i) => <View key={i} style={{ width: i === page ? 30 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? L.ink : L.line }} />)}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get started" onPress={onDone} style={({ pressed }) => ({ height: 56, borderRadius: 16, backgroundColor: L.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: "#fff" }}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const VAULT = "0xCC31c7474267ca5600c2D530ebD7657A09c042Dc";
const NEW_ADDR = "0x7c4f9A2b61e3d0c8F5a4B2e1D6c9A3f8E0b71e42";

function Coin({ label, size, bg, fg = "#fff", style }: { label: string; size: number; bg: string; fg?: string; style?: object }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, shadow, style]}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.42, color: fg }}>{label}</Text>
    </View>
  );
}

/** Page 1: the vault as the app actually shows it, with its assets orbiting. */
function ArtVault() {
  return (
    <View style={{ width: W - 52, height: ART, alignItems: "center", justifyContent: "center" }}>
      <Coin label="K" size={62} bg="#4c6ef5" style={{ position: "absolute", right: 4, top: 14, transform: [{ rotate: "8deg" }] }} />
      <Coin label="S" size={46} bg={C.accent} fg={C.onAccent} style={{ position: "absolute", left: 6, top: 52 }} />
      <View style={{ position: "absolute", left: 40, bottom: 26, width: 18, height: 18, borderRadius: 9, backgroundColor: "#ffd6e0" }} />
      <View style={{ position: "absolute", right: 46, bottom: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: "#c3e2ff" }} />

      <View style={[{ width: 252, backgroundColor: L.bg, borderRadius: 22, padding: 18, transform: [{ rotate: "-3deg" }] }, shadow]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Identicon address={VAULT} size={30} />
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: L.ink, flex: 1 }}>Treasury vault</Text>
          <View style={{ backgroundColor: "#e6f6ec", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontFamily: F.bodyBold, fontSize: 10, color: "#1b7f4a" }}>Normal</Text></View>
        </View>
        <Text style={{ fontFamily: F.display, fontSize: 32, color: L.ink, letterSpacing: -1, marginTop: 14 }}>250,000<Text style={{ fontSize: 15, color: L.ink2 }}>  sUSD</Text></Text>
        <View style={{ height: 1, backgroundColor: L.line, marginVertical: 14 }} />
        {[["S", "Skur Test USD", "250,000", C.accent, C.onAccent], ["K", "KASH", "3", "#4c6ef5", "#fff"]].map(([l, name, amt, bg, fg]) => (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 12, color: fg }}>{l}</Text></View>
            <Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: L.ink, flex: 1 }}>{name}</Text>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: L.ink }}>{amt}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Page 2: the same payment at three sizes, and what the vault asks of each. */
function ArtTiers() {
  const rows: Array<{ amt: string; req: string; tier: string; bg: string; fg: string; dx: number }> = [
    { amt: "1,000 sUSD", req: "1 approval · now", tier: "Low", bg: "#e6f6ec", fg: "#1b7f4a", dx: -14 },
    { amt: "12,000 sUSD", req: "2 approvals · 1 day", tier: "High", bg: "#fff3d6", fg: "#a86a00", dx: 10 },
    { amt: "60,000 sUSD", req: "2 + a guardian", tier: "Critical", bg: "#ffe3e3", fg: "#b42318", dx: -6 },
  ];
  return (
    <View style={{ width: W - 52, height: ART, justifyContent: "center", gap: 14 }}>
      {rows.map((r) => (
        <View key={r.tier} style={[{ backgroundColor: L.bg, borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, transform: [{ translateX: r.dx }] }, shadow]}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: r.bg, alignItems: "center", justifyContent: "center" }}>
            <Icon name="arrow-up-right" size={17} color={r.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: L.ink }}>{r.amt}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: L.ink2, marginTop: 1 }}>{r.req}</Text>
          </View>
          <View style={{ backgroundColor: r.bg, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: r.fg }}>{r.tier}</Text></View>
        </View>
      ))}
    </View>
  );
}

/** Page 3: the alert that reaches you, over the confirmation it opens. */
function ArtSign() {
  return (
    <View style={{ width: W - 52, height: ART, alignItems: "center" }}>
      <View style={{ position: "absolute", top: 54, width: 216, height: 256, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 5, borderBottomWidth: 0, borderColor: L.ink, backgroundColor: L.bg, overflow: "hidden" }}>
        <View style={{ alignSelf: "center", width: 80, height: 20, backgroundColor: L.ink, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />
        <View style={{ alignItems: "center", marginTop: 70 }}>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: L.ink2 }}>Confirm transaction</Text>
          <Text style={{ fontFamily: F.display, fontSize: 27, color: L.ink, marginTop: 8, letterSpacing: -0.8 }}>−12,000 sUSD</Text>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: L.ink2, marginTop: 3 }}>to 0x7c4f…41e2</Text>
        </View>
      </View>

      <View style={[{ position: "absolute", top: 4, left: 2, right: 2, backgroundColor: L.bg, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, shadow]}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#e7f1ff", alignItems: "center", justifyContent: "center" }}><Icon name="bell" size={16} color="#1971c2" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: L.ink, lineHeight: 19 }}><Text style={{ fontFamily: F.bodyBold }}>A transaction</Text> needs you</Text>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: L.ink2, marginTop: 1 }}>just now</Text>
        </View>
        <Icon name="chevron-right" size={16} color={L.ink2} />
      </View>

      <View style={[{ position: "absolute", bottom: 26, right: 4, backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 16, height: 44, flexDirection: "row", alignItems: "center", gap: 8 }, shadow]}>
        <Icon name="check-circle" size={17} color={C.onAccent} />
        <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.onAccent }}>Policy check passed</Text>
      </View>
    </View>
  );
}
