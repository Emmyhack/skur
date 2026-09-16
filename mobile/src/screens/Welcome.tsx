import { useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StatusBar, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Identicon } from "../components/Identicon";
import { Icon } from "../components/ui";
import { C, F } from "../theme";

const W = Dimensions.get("window").width;
/** Light tokens for the first-launch screens, matching the web's marketing pages. */
const L = { bg: "#ffffff", text: "#212529", text2: "#6c757d", card: "#f1f3f5", card2: "#e9ecef", border: "#dee2e6" };

const PAGES = [
  { title: "Track your\nvaults. Anywhere.", sub: "Easily track balances and get real-time updates on vault activity, anytime.", art: <ArtTrack /> },
  { title: "Sign transactions\non the go", sub: "Enjoy peace of mind with transaction checks, ensuring secure signing.", art: <ArtSign /> },
  { title: "Get\npersonalized\nupdates", sub: "Stay informed with notifications tailored to your vaults.", art: <ArtUpdates /> },
];

/** First launch, after Safe{Mobile}: wordmark, illustration, headline, dots, one black button. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  return (
    <View style={{ flex: 1, backgroundColor: L.bg, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 16) }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, fontSize: 18, color: C.onAccent }}>S</Text></View>
        <Text style={{ fontFamily: F.display, fontSize: 28, color: L.text, letterSpacing: -0.5 }}>Skur</Text>
        <Text style={{ fontFamily: F.monoMedium, fontSize: 12, color: L.text, backgroundColor: C.accent, paddingHorizontal: 6, paddingVertical: 2, letterSpacing: 1, marginTop: 4 }}>MOBILE</Text>
      </View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        {PAGES.map((p, i) => (
          <View key={i} style={{ width: W, paddingHorizontal: 24 }}>
            <View style={{ height: 330, justifyContent: "center", alignItems: "center", marginTop: 16 }}>{p.art}</View>
            <Text style={{ fontFamily: F.display, fontSize: 44, lineHeight: 48, color: L.text, textAlign: "center", letterSpacing: -1.2, marginTop: 40 }}>{p.title}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 23, color: L.text2, textAlign: "center", marginTop: 18, paddingHorizontal: 8 }}>{p.sub}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 22 }}>
        {PAGES.map((_, i) => <View key={i} style={{ width: i === page ? 32 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? L.text : L.border }} />)}
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get started" onPress={onDone} style={({ pressed }) => ({ height: 56, borderRadius: 14, backgroundColor: L.text, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: "#fff" }}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const A1 = "0xCC31c7474267ca5600c2D530ebD7657A09c042Dc";
const A2 = "0x4FEA262782b5BE34B18cf24b6aC026215899EEc0";
const A3 = "0xCec10C48B8d37b6A083000173e3415Cc6f86974F";

function Blur({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return <View style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.35 }} />;
}

/** Floating token and vault icons, as on Safe's first page; the Skur tile takes the place of the green Safe tile. */
function ArtTrack() {
  return (
    <View style={{ width: W, height: 330 }}>
      <Blur x={40} y={20} size={36} color="#ff6b6b" />
      <Blur x={W - 120} y={130} size={40} color={C.accent} />
      <Blur x={110} y={220} size={30} color="#4dabf7" />
      <Blur x={W - 60} y={250} size={28} color="#69db7c" />
      <View style={{ position: "absolute", left: W * 0.42, top: 10, transform: [{ rotate: "12deg" }] }}><View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#845ef7", alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, color: "#fff", fontSize: 26 }}>A</Text></View></View>
      <View style={{ position: "absolute", right: -10, top: 60 }}><View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "#4c6ef5", alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, color: "#fff", fontSize: 44 }}>K</Text></View></View>
      <View style={{ position: "absolute", left: 60, top: 96, transform: [{ rotate: "-8deg" }] }}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", opacity: 0.85 }}><Text style={{ fontFamily: F.display, color: C.onAccent, fontSize: 24 }}>S</Text></View></View>
      <View style={{ position: "absolute", right: 90, top: 150, transform: [{ rotate: "10deg" }] }}><View style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden" }}><Identicon address={A1} size={96} /></View></View>
      <View style={{ position: "absolute", left: -20, top: 190, transform: [{ rotate: "-14deg" }] }}><View style={{ width: 128, height: 128, borderRadius: 26, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.display, color: C.onAccent, fontSize: 76, marginTop: -4 }}>S</Text></View></View>
      <View style={{ position: "absolute", right: 30, bottom: 30 }}><View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: "#12b886", alignItems: "center", justifyContent: "center" }}><Identicon address={A3} size={44} /></View></View>
    </View>
  );
}

/** Phone mockup with the signer picker and a toast, as on Safe's second page. */
function ArtSign() {
  return (
    <View style={{ width: W, height: 330, alignItems: "center" }}>
      <View style={{ width: 300, height: 300, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderWidth: 6, borderBottomWidth: 0, borderColor: L.text, backgroundColor: L.bg, overflow: "hidden", paddingTop: 40 }}>
        <View style={{ position: "absolute", top: 0, left: 80, right: 80, height: 28, backgroundColor: L.text, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }} />
        <Text style={{ fontFamily: F.bodyBold, fontSize: 17, color: L.text, textAlign: "center", marginBottom: 14 }}>Select signer</Text>
        <View style={{ marginHorizontal: 14, backgroundColor: L.card, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Identicon address={A2} size={36} /><View style={{ flex: 1 }}><Text style={{ fontFamily: F.bodyBold, color: L.text, fontSize: 14 }}>My signer</Text><View style={{ height: 8, width: 110, borderRadius: 4, backgroundColor: L.card2, marginTop: 6 }} /></View><Icon name="check" size={18} color={L.text} />
        </View>
        {[A3, A1].map((a, i) => (
          <View key={a} style={{ marginHorizontal: 14, marginTop: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: i === 0 ? 0.55 : 0.3 }}>
            <Identicon address={a} size={36} /><View><Text style={{ fontFamily: F.bodyBold, color: L.text, fontSize: 14 }}>My signer #{i + 2}</Text><View style={{ height: 8, width: 110, borderRadius: 4, backgroundColor: L.card2, marginTop: 6 }} /></View>
          </View>
        ))}
      </View>
      <View style={{ position: "absolute", right: 8, top: 150, backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 16, height: 46, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }}>
        <Icon name="check-circle" size={18} color={C.onAccent} /><Text style={{ fontFamily: F.bodyBold, color: C.onAccent, fontSize: 15 }}>Policy check passed</Text>
      </View>
    </View>
  );
}

/** Stacked notification cards, as on Safe's third page. */
function ArtUpdates() {
  const cards: Array<{ text: string; when: string; tone: string; icon: "info" | "check" | "alert-circle"; strong?: string; w: number; dy: number; dim: number }> = [
    { strong: "A transaction", text: " requires your confirmation", when: "about 1 hour ago", tone: "#4dabf7", icon: "info", w: 1, dy: 0, dim: 1 },
    { text: "", when: "about 2 hours ago", tone: "#40c057", icon: "check", w: 0.9, dy: 92, dim: 0.75 },
    { text: "", when: "Just now", tone: "#fa5252", icon: "alert-circle", w: 0.82, dy: 176, dim: 0.5 },
  ];
  return (
    <View style={{ width: W, height: 330, alignItems: "center" }}>
      <View style={{ position: "absolute", top: 0, width: 300, height: 300, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderWidth: 6, borderBottomWidth: 0, borderColor: L.text, backgroundColor: L.bg }}>
        <View style={{ position: "absolute", top: 0, left: 80, right: 80, height: 28, backgroundColor: L.text, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }} />
      </View>
      {cards.map((c, i) => (
        <View key={i} style={{ position: "absolute", top: 70 + c.dy, width: (W - 32) * c.w, backgroundColor: L.bg, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, opacity: c.dim, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, zIndex: 3 - i }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tone + "22", alignItems: "center", justifyContent: "center" }}><Icon name={c.icon} size={18} color={c.tone} /></View>
          <View style={{ flex: 1 }}>
            {c.strong ? <Text style={{ fontFamily: F.body, fontSize: 15, color: L.text }}><Text style={{ fontFamily: F.bodyBold }}>{c.strong}</Text>{c.text}</Text> : <View style={{ height: 10, width: "70%", borderRadius: 5, backgroundColor: L.card2, marginBottom: 6 }} />}
            <Text style={{ fontFamily: F.body, fontSize: 13, color: L.text2, marginTop: 2 }}>{c.when}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={L.text2} />
        </View>
      ))}
    </View>
  );
}
