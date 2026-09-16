import * as Clipboard from "expo-clipboard";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { short } from "@web/lib/format";
import { Mode, MODE_LABEL, Status, STATUS_LABEL, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "@web/lib/types";
import type { TxState } from "../hooks/useTx";
import { C, F, R } from "../theme";

export function Screen({ children, title, sub, right, refreshControl, scroll = true }: { children: ReactNode; title?: string; sub?: string; right?: ReactNode; refreshControl?: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const head = title ? (
    <View style={[s.head, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;
  if (!scroll) return <View style={s.screen}>{head}{children}</View>;
  return (
    <View style={s.screen}>
      {head}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={refreshControl as never} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </View>
  );
}

export function Card({ children, title, action, style }: { children: ReactNode; title?: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      {(title || action) && (
        <View style={s.cardHead}>
          {title ? <Text style={s.cardTitle}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function KV({ k, v, mono = false, last = false }: { k: string; v: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <View style={[s.kv, last && { borderBottomWidth: 0 }]}>
      <Text style={s.kvK}>{k}</Text>
      {typeof v === "string" || typeof v === "number" ? <Text style={[s.kvV, mono && { fontFamily: F.mono, fontSize: 13 }]} numberOfLines={2}>{v}</Text> : v}
    </View>
  );
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: C.successBg, fg: C.success },
  warn: { bg: C.warningBg, fg: C.warning },
  bad: { bg: C.errorBg, fg: C.error },
  info: { bg: C.infoBg, fg: C.info },
  neutral: { bg: C.panel2, fg: C.text2 },
  accent: { bg: C.accent, fg: C.onAccent },
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return <View style={[s.badge, { backgroundColor: t.bg }]}><Text style={[s.badgeText, { color: t.fg }]}>{children}</Text></View>;
}
export const TierBadge = ({ tier }: { tier: Tier }) => <Badge tone={tier === Tier.LOW ? "ok" : tier === Tier.HIGH ? "warn" : "bad"}>{TIER_LABEL[tier]}</Badge>;
export const ModeBadge = ({ mode }: { mode: Mode }) => <Badge tone={mode === Mode.NORMAL ? "ok" : mode === Mode.ELEVATED ? "warn" : "bad"}>{MODE_LABEL[mode]}</Badge>;
export const StatusBadge = ({ status }: { status: Status }) => <Badge tone={status === Status.EXECUTED ? "ok" : status === Status.PENDING ? "warn" : status === Status.VETOED ? "bad" : "neutral"}>{STATUS_LABEL[status]}</Badge>;
export const TrustBadge = ({ trust }: { trust: Trust }) => <Badge tone={trust === Trust.BLOCKED || trust === Trust.RESTRICTED ? "bad" : trust === Trust.NEW || trust === Trust.UNKNOWN ? "info" : "ok"}>{TRUST_LABEL[trust]}</Badge>;

export function Button({ children, onPress, kind = "primary", disabled, loading, style }: { children: ReactNode; onPress?: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === "primary" ? C.accent : kind === "danger" ? C.errorBg : kind === "secondary" ? C.panel2 : "transparent";
  const fg = kind === "primary" ? C.onAccent : kind === "danger" ? C.error : C.text;
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, kind === "secondary" && { borderWidth: 1, borderColor: C.border }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{children}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}
export function Input(props: TextInputProps & { mono?: boolean }) {
  return <TextInput placeholderTextColor={C.text3} autoCapitalize="none" autoCorrect={false} {...props} style={[s.input, props.mono && { fontFamily: F.mono, fontSize: 13 }, props.style]} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.segItem, value === v && s.segOn]}><Text style={[s.segText, value === v && { color: C.onAccent }]}>{label}</Text></Pressable>
      ))}
    </View>
  );
}

export function Address({ value, full = false }: { value: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable onPress={async () => { await Clipboard.setStringAsync(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }} hitSlop={8}>
      <Text style={s.addr}>{full ? value : short(value)}{copied ? "  ✓ copied" : ""}</Text>
    </Pressable>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return <View style={[s.notice, { backgroundColor: t.bg }]}><Text style={{ color: t.fg, fontFamily: F.body, fontSize: 14, lineHeight: 20 }}>{children}</Text></View>;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  if (state.phase === "error") return <Notice tone="bad">{state.message}</Notice>;
  if (state.phase === "done") return <Notice tone="ok">Confirmed onchain · {short(state.hash, 6)}</Notice>;
  const msg = state.phase === "auth" ? "Waiting for authentication…" : state.phase === "simulating" ? "Checking the transaction against the vault's policy…" : "Waiting for the block…";
  return <Notice tone="info">{msg}</Notice>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <View style={{ padding: 28, alignItems: "center" }}><Text style={{ color: C.text2, fontFamily: F.body, textAlign: "center" }}>{children}</Text></View>;
}

export function Tape({ running = false }: { running?: boolean }) {
  // Caution-tape band: the brand's signature, drawn as alternating blocks. Static on native; `running` is reserved for Lockdown.
  return (
    <View style={{ height: 8, flexDirection: "row", overflow: "hidden", opacity: running ? 1 : 0.9 }}>
      {Array.from({ length: 30 }).map((_, i) => <View key={i} style={{ width: 14, backgroundColor: i % 2 ? C.canvas : C.accent, transform: [{ skewX: "-45deg" }] }} />)}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  head: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  h1: { fontFamily: F.display, fontSize: 28, color: C.text, letterSpacing: -0.5 },
  sub: { fontFamily: F.body, fontSize: 14, color: C.text2, marginTop: 2 },
  card: { backgroundColor: C.panel, borderRadius: R.lg, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { fontFamily: F.displayMedium, fontSize: 17, color: C.text },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  kvK: { fontFamily: F.body, fontSize: 14, color: C.text2 },
  kvV: { fontFamily: F.bodyMedium, fontSize: 14, color: C.text, textAlign: "right", flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm, alignSelf: "flex-start" },
  badgeText: { fontFamily: F.bodyBold, fontSize: 12 },
  btn: { height: 46, borderRadius: R.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnText: { fontFamily: F.bodyBold, fontSize: 15 },
  label: { fontFamily: F.bodyMedium, fontSize: 13, color: C.text2, marginBottom: 6 },
  hint: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 6, lineHeight: 16 },
  input: { backgroundColor: C.panel2, borderRadius: R.md, paddingHorizontal: 12, height: 46, color: C.text, fontFamily: F.body, fontSize: 15, borderWidth: 1, borderColor: C.border },
  seg: { flexDirection: "row", backgroundColor: C.panel2, borderRadius: R.md, padding: 3, marginBottom: 14 },
  segItem: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: R.sm },
  segOn: { backgroundColor: C.accent },
  segText: { fontFamily: F.bodyBold, fontSize: 13, color: C.text2 },
  addr: { fontFamily: F.mono, fontSize: 13, color: C.text },
  notice: { padding: 12, borderRadius: R.md, marginTop: 10 },
});
