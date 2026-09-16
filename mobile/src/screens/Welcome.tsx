import { useRef, useState } from "react";
import { Dimensions, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Identicon } from "../components/Identicon";
import { Badge, Button, CircleIcon, Icon, Logo, Tape, s } from "../components/ui";
import { C, F } from "../theme";

const W = Dimensions.get("window").width;

/** First-launch carousel, after Safe{Mobile}'s: illustration, headline, dots, one button. Three pages, Skur's pattern. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  const pages = [
    { title: "Watch your\ntreasury. Anywhere.", sub: "Balances, the queue and the policy, read straight from the vault contract. No server in between.", art: <ArtTreasury /> },
    { title: "Sign from\nyour phone", sub: "A key kept in this phone's keychain, behind Face ID. Every payment is scored by the vault before you sign.", art: <ArtSign /> },
    { title: "Every payment,\nscored first", sub: "Amount, recipient trust, today's outflow and the security mode set how many approvals it needs and how long it waits.", art: <ArtTiers /> },
  ];
  return (
    <View style={[s.screen, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={{ alignItems: "center" }}><Logo size={30} /></View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        {pages.map((p, i) => (
          <View key={i} style={{ width: W, paddingHorizontal: 24, justifyContent: "center" }}>
            <View style={{ height: 300, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>{p.art}</View>
            <Text style={{ fontFamily: F.display, fontSize: 40, lineHeight: 44, color: C.text, textAlign: "center", letterSpacing: -1 }}>{p.title}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text2, textAlign: "center", marginTop: 14 }}>{p.sub}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 18 }}>
        {pages.map((_, i) => <View key={i} style={{ width: i === page ? 28 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? C.accent : C.border }} />)}
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Button onPress={() => (page < pages.length - 1 ? ref.current?.scrollTo({ x: W * (page + 1), animated: true }) : onDone())}>{page < pages.length - 1 ? "Next" : "Get started"}</Button>
        <Text onPress={onDone} style={[s.hint, { textAlign: "center", marginTop: 12, fontSize: 13 }]}>Skip</Text>
      </View>
    </View>
  );
}

const A1 = "0xCC31c7474267ca5600c2D530ebD7657A09c042Dc";
const A2 = "0x4FEA262782b5BE34B18cf24b6aC026215899EEc0";
const A3 = "0xCec10C48B8d37b6A083000173e3415Cc6f86974F";

function ArtTreasury() {
  return (
    <View style={{ width: 300, height: 280 }}>
      <View style={{ position: "absolute", left: 20, top: 30, transform: [{ rotate: "-8deg" }] }}><CircleIcon size={64} tone="accent" text="K" /></View>
      <View style={{ position: "absolute", right: 24, top: 10, transform: [{ rotate: "10deg" }] }}><CircleIcon size={76} text="S" /></View>
      <View style={{ position: "absolute", left: 110, top: 96 }}><Identicon address={A1} size={88} badge="2/3" /></View>
      <View style={{ position: "absolute", left: 10, bottom: 40 }}><Identicon address={A2} size={52} /></View>
      <View style={{ position: "absolute", right: 16, bottom: 24, transform: [{ rotate: "-6deg" }] }}><Badge tone="ok" icon="shield">Normal</Badge></View>
      <View style={{ position: "absolute", right: 60, bottom: 80 }}><Identicon address={A3} size={44} /></View>
      <View style={{ position: "absolute", left: 60, bottom: 0, right: 60 }}><Tape height={6} /></View>
    </View>
  );
}

function ArtSign() {
  return (
    <View style={{ width: 300, height: 280, alignItems: "center" }}>
      <View style={{ width: 260, height: 250, borderRadius: 34, borderWidth: 6, borderColor: C.card2, backgroundColor: C.card, overflow: "hidden", paddingTop: 34 }}>
        <View style={{ position: "absolute", top: 0, left: 70, right: 70, height: 24, backgroundColor: C.card2, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }} />
        <Text style={{ fontFamily: F.bodyBold, color: C.text, textAlign: "center", marginBottom: 10 }}>Select signer</Text>
        <View style={{ marginHorizontal: 12, backgroundColor: C.canvas, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }}><Identicon address={A2} size={28} /><View style={{ flex: 1 }}><Text style={{ fontFamily: F.bodyBold, color: C.text, fontSize: 13 }}>Device signer</Text><View style={{ height: 6, width: 90, borderRadius: 3, backgroundColor: C.card2, marginTop: 4 }} /></View><Icon name="check" size={16} color={C.accent} /></View>
        <View style={{ marginHorizontal: 12, marginTop: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.5 }}><Identicon address={A3} size={28} /><View style={{ height: 6, width: 110, borderRadius: 3, backgroundColor: C.card2 }} /></View>
      </View>
      <View style={{ position: "absolute", right: -6, top: 118, backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 14, height: 40, flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="check-circle" size={16} color={C.onAccent} /><Text style={{ fontFamily: F.bodyBold, color: C.onAccent }}>Policy check passed</Text></View>
    </View>
  );
}

function ArtTiers() {
  const rows: Array<[string, string, "ok" | "warn" | "bad"]> = [["1,000 sUSD · known supplier", "Low · 1 approval · now", "ok"], ["12,000 sUSD · new address", "High · 2 approvals · 1 day", "warn"], ["60,000 sUSD · 24% of holdings", "Critical · 2 + guardian", "bad"]];
  return (
    <View style={{ width: 320, gap: 10 }}>
      {rows.map(([a, b, t], i) => (
        <View key={a} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, transform: [{ translateX: (i - 1) * 10 }] }}>
          <CircleIcon name="arrow-up-right" size={36} tone={t === "ok" ? "success" : t === "warn" ? "warn" : "error"} />
          <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bodyBold, color: C.text, fontSize: 13 }}>{a}</Text><Text style={{ fontFamily: F.body, color: C.text2, fontSize: 12 }}>{b}</Text></View>
          <Badge tone={t}>{t === "ok" ? "Low" : t === "warn" ? "High" : "Critical"}</Badge>
        </View>
      ))}
    </View>
  );
}
