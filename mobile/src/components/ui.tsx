import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { short } from "@web/lib/format";
import { Mode, MODE_LABEL, Status, STATUS_LABEL, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "@web/lib/types";
import type { TxState } from "../hooks/useTx";
import { C, F, R } from "../theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export const Icon = ({ name, size = 18, color = C.text }: { name: IconName; size?: number; color?: string }) => <Feather name={name} size={size} color={color} />;

/** Screen shell: optional top bar, scrolling body, optional sticky footer above the home indicator. */
export function Screen({ children, top, footer, refreshControl, padded = true }: { children: ReactNode; top?: ReactNode; footer?: ReactNode; refreshControl?: ReactNode; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      {top ? <View style={{ paddingTop: insets.top + 6 }}>{top}</View> : null}
      <ScrollView contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: footer ? 120 : 40 }} refreshControl={refreshControl as never} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
      {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
    </View>
  );
}

export function TopBar({ left, center, right, title }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; title?: string }) {
  return (
    <View style={s.topbar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>{left}{title ? <Text style={s.topTitle}>{title}</Text> : null}</View>
      {center ? <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "none" }}>{center}</View> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{right}</View>
    </View>
  );
}

export function IconButton({ name, onPress, dot, tone = "dark" }: { name: IconName; onPress?: () => void; dot?: boolean; tone?: "dark" | "accent" }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [s.iconBtn, tone === "accent" && { backgroundColor: C.accent }, pressed && { opacity: 0.7 }]}>
      <Icon name={name} size={18} color={tone === "accent" ? C.onAccent : C.text} />
      {dot ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) { return <IconButton name="arrow-left" onPress={onPress} />; }

/** The web logo: yellow square with an S, then the wordmark. */
export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.32 }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: F.display, fontSize: size * 0.58, color: C.onAccent, lineHeight: size * 0.7 }}>S</Text>
      </View>
      {wordmark ? <Text style={{ fontFamily: F.display, fontSize: size * 0.8, color: C.text, letterSpacing: -0.5 }}>Skur</Text> : null}
    </View>
  );
}

export function Card({ children, style, flush = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  return <View style={[s.card, flush && { padding: 0, overflow: "hidden" }, style]}>{children}</View>;
}
export function SectionLabel({ children }: { children: ReactNode }) { return <Text style={s.sectionLabel}>{children}</Text>; }

/** Safe-style list row: leading icon or avatar, title, subtitle, trailing content, optional chevron. */
export function Row({ leading, title, subtitle, trailing, onPress, chevron = false, last = false }: { leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; last?: boolean }) {
  const body = (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      {leading ? <View style={{ width: 40, alignItems: "center" }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === "string" ? <Text style={s.rowTitle} numberOfLines={1}>{title}</Text> : title}
        {subtitle ? (typeof subtitle === "string" ? <Text style={s.rowSub} numberOfLines={1}>{subtitle}</Text> : subtitle) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={18} color={C.text3} /> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={typeof title === "string" ? (typeof subtitle === "string" ? `${title}, ${subtitle}` : title) : undefined} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>{body}</Pressable> : body;
}

export function CircleIcon({ name, size = 40, tone = "dark", text }: { name?: IconName; size?: number; tone?: "dark" | "accent" | "success" | "error" | "warn"; text?: string }) {
  const bg = tone === "accent" ? C.accent : tone === "success" ? C.successBg : tone === "error" ? C.errorBg : tone === "warn" ? C.warningBg : C.card2;
  const fg = tone === "accent" ? C.onAccent : tone === "success" ? C.success : tone === "error" ? C.error : tone === "warn" ? C.warning : C.text;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      {text ? <Text style={{ fontFamily: F.display, color: fg, fontSize: size * 0.4 }}>{text}</Text> : name ? <Icon name={name} size={size * 0.45} color={fg} /> : null}
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
  ok: { bg: C.successBg, fg: C.success }, warn: { bg: C.warningBg, fg: C.warning }, bad: { bg: C.errorBg, fg: C.error },
  info: { bg: C.infoBg, fg: C.info }, neutral: { bg: C.card2, fg: C.text2 }, accent: { bg: C.accent, fg: C.onAccent },
};
export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: IconName }) {
  const t = TONES[tone];
  return <View style={[s.badge, { backgroundColor: t.bg }]}>{icon ? <Icon name={icon} size={12} color={t.fg} /> : null}<Text style={[s.badgeText, { color: t.fg }]}>{children}</Text></View>;
}
export const TierBadge = ({ tier }: { tier: Tier }) => <Badge tone={tier === Tier.LOW ? "ok" : tier === Tier.HIGH ? "warn" : "bad"}>{TIER_LABEL[tier]}</Badge>;
export const ModeBadge = ({ mode }: { mode: Mode }) => <Badge tone={mode === Mode.NORMAL ? "ok" : mode === Mode.ELEVATED ? "warn" : "bad"} icon="shield">{MODE_LABEL[mode]}</Badge>;
export const StatusBadge = ({ status }: { status: Status }) => <Badge tone={status === Status.EXECUTED ? "ok" : status === Status.PENDING ? "warn" : status === Status.VETOED ? "bad" : "neutral"}>{STATUS_LABEL[status]}</Badge>;
export const TrustBadge = ({ trust }: { trust: Trust }) => <Badge tone={trust === Trust.BLOCKED || trust === Trust.RESTRICTED ? "bad" : trust === Trust.NEW || trust === Trust.UNKNOWN ? "info" : "ok"}>{TRUST_LABEL[trust]}</Badge>;

export function Button({ children, onPress, kind = "primary", disabled, loading, icon, style, size = "md" }: { children: ReactNode; onPress?: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; size?: "md" | "sm" }) {
  const bg = kind === "primary" ? C.accent : kind === "danger" ? C.errorBg : kind === "secondary" ? C.card2 : "transparent";
  const fg = kind === "primary" ? C.onAccent : kind === "danger" ? C.error : C.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={typeof children === "string" ? children : undefined} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.btn, size === "sm" && { height: 36, paddingHorizontal: 14 }, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon ? <Icon name={icon} size={16} color={fg} /> : null}<Text style={[s.btnText, size === "sm" && { fontSize: 13 }, { color: fg }]}>{children}</Text></>}
    </Pressable>
  );
}

/** Safe's sticky "Sign with ‹signer›" bar, used for the primary action of a screen. */
export function SignBar({ label, signerAddress, onPress, disabled, loading, hint }: { label: string; signerAddress?: string | null; onPress?: () => void; disabled?: boolean; loading?: boolean; hint?: string }) {
  return (
    <View>
      {hint ? <Text style={[s.hint, { textAlign: "center", marginBottom: 8 }]}>{hint}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.signbar, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
        {loading ? <ActivityIndicator color={C.onAccent} /> : <Icon name="edit-3" size={18} color={C.onAccent} />}
        <Text style={s.signbarText}>{label}</Text>
        {signerAddress ? <View style={s.signerChip}><Text style={s.signerChipText}>{short(signerAddress)}</Text></View> : null}
        <Icon name="chevron-right" size={18} color={C.onAccent} />
      </Pressable>
    </View>
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
export const Input = forwardRef<TextInput, TextInputProps & { mono?: boolean; big?: boolean }>(function Input(props, ref) {
  return <TextInput ref={ref} placeholderTextColor={C.text3} autoCapitalize="none" autoCorrect={false} {...props} style={[s.input, props.mono && { fontFamily: F.mono, fontSize: 13 }, props.big && { fontFamily: F.display, fontSize: 34, height: 64, textAlign: "center", borderWidth: 0, backgroundColor: "transparent" }, props.style]} />;
});

/** Underlined text tabs, as on Safe's Tokens / NFTs switch. */
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <View style={s.tabs}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.tab, value === v && s.tabOn]}><Text style={[s.tabText, value === v && { color: C.text }]}>{label}</Text></Pressable>
      ))}
    </View>
  );
}

export function Address({ value, full = false, style }: { value: string; full?: boolean; style?: object }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable onPress={async () => { await Clipboard.setStringAsync(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={[s.addr, style]} numberOfLines={full ? 2 : 1}>{full ? value : short(value)}</Text>
      <Icon name={copied ? "check" : "copy"} size={13} color={copied ? C.success : C.text3} />
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

export function Empty({ icon = "inbox", children }: { icon?: IconName; children: ReactNode }) {
  return <View style={{ padding: 32, alignItems: "center", gap: 10 }}><CircleIcon name={icon} size={48} /><Text style={{ color: C.text2, fontFamily: F.body, textAlign: "center", lineHeight: 20 }}>{children}</Text></View>;
}

/** Caution-tape band: the brand's signature. */
export function Tape({ height = 8 }: { height?: number }) {
  return (
    <View style={{ height, flexDirection: "row", overflow: "hidden" }}>
      {Array.from({ length: 34 }).map((_, i) => <View key={i} style={{ width: 14, backgroundColor: i % 2 ? C.canvas : C.accent, transform: [{ skewX: "-45deg" }] }} />)}
    </View>
  );
}

/** Bottom sheet like Safe's account and network switchers. */
export function Sheet({ open, onClose, title, children, action }: { open: boolean; onClose: () => void; title: string; children: ReactNode; action?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={s.grabber} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Text style={s.sheetTitle}>{title}</Text>
          {action ? <View style={{ position: "absolute", right: 0 }}>{action}</View> : null}
        </View>
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  topbar: { height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { fontFamily: F.display, fontSize: 22, color: C.text, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.canvas },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, marginBottom: 12 },
  sectionLabel: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.text3, marginBottom: 8, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowTitle: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  rowSub: { fontFamily: F.body, fontSize: 13, color: C.text2 },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  kvK: { fontFamily: F.body, fontSize: 14, color: C.text2 },
  kvV: { fontFamily: F.bodyMedium, fontSize: 14, color: C.text, textAlign: "right", flexShrink: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, alignSelf: "flex-start" },
  badgeText: { fontFamily: F.bodyBold, fontSize: 12 },
  btn: { height: 48, borderRadius: R.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexDirection: "row", gap: 8 },
  btnText: { fontFamily: F.bodyBold, fontSize: 15 },
  signbar: { height: 56, borderRadius: R.lg, backgroundColor: C.accent, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18 },
  signbarText: { fontFamily: F.bodyBold, fontSize: 16, color: C.onAccent, flex: 1 },
  signerChip: { backgroundColor: "rgba(33,37,41,0.15)", borderRadius: R.pill, paddingHorizontal: 10, height: 28, justifyContent: "center" },
  signerChipText: { fontFamily: F.monoMedium, fontSize: 12, color: C.onAccent },
  label: { fontFamily: F.bodyMedium, fontSize: 13, color: C.text2, marginBottom: 6 },
  hint: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 6, lineHeight: 16 },
  input: { backgroundColor: C.card2, borderRadius: R.md, paddingHorizontal: 14, height: 48, color: C.text, fontFamily: F.body, fontSize: 15, borderWidth: 1, borderColor: C.border },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginBottom: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 22, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabOn: { borderBottomColor: C.accent },
  tabText: { fontFamily: F.bodyBold, fontSize: 15, color: C.text3 },
  addr: { fontFamily: F.mono, fontSize: 13, color: C.text2 },
  notice: { padding: 12, borderRadius: R.md, marginTop: 10 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontFamily: F.display, fontSize: 18, color: C.text },
});
