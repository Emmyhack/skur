import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MODE_LABELS,
  Mode,
  STATUS_LABELS,
  Status,
  TIER_LABELS,
  Tier,
  TRUST_LABELS,
  Trust,
  short,
} from "@skur/sdk";
import type { TxState } from "../hooks/useTx";
import { useTheme } from "../state/theme";
import { F, R, type Palette } from "../theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const C = useTheme();
  return <Feather name={name} size={size} color={color ?? C.text} />;
}

export function Screen({ children, top, footer, refreshControl, padded = true, centered = false }: { children: ReactNode; top?: ReactNode; footer?: ReactNode; refreshControl?: ReactNode; padded?: boolean; centered?: boolean }) {
  const C = useTheme(); const s = useStyles(); const insets = useSafeAreaInsets();
  return (
    // Without the avoiding view, the keyboard covers the footer — which on Send is the submit
    // button, so the screen looks broken exactly when someone is mid-payment. Android resizes the
    // window itself (adjustResize), so the behaviour only applies on iOS.
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {top ? <View style={{ paddingTop: insets.top + 6 }}>{top}</View> : null}
      {/* `centered`: sparse screens (the launch, the fork, a lone empty state) sit in the
          middle of the viewport instead of hugging the status bar with a void below. */}
      <ScrollView contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: footer ? 120 : 40, ...(centered ? { flexGrow: 1, justifyContent: "center" } : null) }} refreshControl={refreshControl as never} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" indicatorStyle={C.canvas === "#ffffff" ? "black" : "white"}>{children}</ScrollView>
      {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function TopBar({ left, center, right, title }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; title?: string }) {
  const s = useStyles();
  return (
    <View style={s.topbar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>{left}{title ? <Text style={s.topTitle}>{title}</Text> : null}</View>
      {center ? <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "none" }}>{center}</View> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{right}</View>
    </View>
  );
}

export function IconButton({ name, onPress, dot, tone = "dark", label }: { name: IconName; onPress?: () => void; dot?: boolean; tone?: "dark" | "accent"; label?: string }) {
  const C = useTheme(); const s = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? name} onPress={onPress} hitSlop={6} style={({ pressed }) => [s.iconBtn, tone === "accent" && { backgroundColor: C.accent }, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={18} color={tone === "accent" ? C.onAccent : C.text} />
      {dot ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) { return <IconButton name="arrow-left" label="Back" onPress={onPress} />; }

/** The web logo: a yellow tile with an S, then the wordmark. */
export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.32 }}>
      {/* The mark itself, not a stand-in letter. Yellow on transparent, so it sits on either ground. */}
      <Image source={require("../../assets/mark.png")} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Skur" />
      {wordmark ? <Text style={{ fontFamily: F.display, fontSize: size * 0.8, color: C.text, letterSpacing: -0.5 }}>Skur</Text> : null}
    </View>
  );
}

/** A card that opens on tap: the header carries the value, so a long screen reads as a short list. */
export function Expandable({ title, summary, icon, tone = "dark", children, open, onToggle }: { title: string; summary?: string; icon?: IconName; tone?: Tone; children: ReactNode; open: boolean; onToggle: () => void }) {
  const C = useTheme(); const s = useStyles();
  return (
    <View style={[s.card, { padding: 0, overflow: "hidden" }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={summary ? `${title}, ${summary}` : title} onPress={onToggle} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }, pressed && { opacity: 0.6 }]}>
        {icon ? <CircleIcon name={icon} size={38} tone={tone} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>{title}</Text>
          {summary ? <Text style={s.rowSub} numberOfLines={open ? undefined : 1}>{summary}</Text> : null}
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={C.text3} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
}

export function Card({ children, style, flush = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const s = useStyles();
  return <View style={[s.card, flush && { padding: 0, overflow: "hidden" }, style]}>{children}</View>;
}
export function SectionLabel({ children }: { children: ReactNode }) { const s = useStyles(); return <Text style={s.sectionLabel}>{children}</Text>; }

/** The list row every screen is built from: leading mark, title, value, chevron. */
export function Row({ leading, title, subtitle, trailing, onPress, chevron = false, last = false }: { leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; last?: boolean }) {
  const C = useTheme(); const s = useStyles();
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
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={typeof title === "string" ? (typeof subtitle === "string" ? `${title}, ${subtitle}` : title) : undefined} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>{body}</Pressable> : body;
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent" | "dark" | "success" | "error";
function tones(C: Palette): Record<Tone, { bg: string; fg: string }> {
  return {
    ok: { bg: C.successBg, fg: C.success }, success: { bg: C.successBg, fg: C.success },
    warn: { bg: C.warningBg, fg: C.warning }, bad: { bg: C.errorBg, fg: C.error }, error: { bg: C.errorBg, fg: C.error },
    info: { bg: C.infoBg, fg: C.info }, neutral: { bg: C.card2, fg: C.text2 }, dark: { bg: C.card2, fg: C.text },
    accent: { bg: C.accent, fg: C.onAccent },
  };
}

export function CircleIcon({ name, size = 40, tone = "dark", text }: { name?: IconName; size?: number; tone?: Tone; text?: string }) {
  const C = useTheme(); const t = tones(C)[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      {text ? <Text style={{ fontFamily: F.display, color: t.fg, fontSize: size * 0.4 }}>{text}</Text> : name ? <Icon name={name} size={size * 0.45} color={t.fg} /> : null}
    </View>
  );
}

export function KV({ k, v, mono = false, last = false }: { k: string; v: ReactNode; mono?: boolean; last?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.kv, last && { borderBottomWidth: 0 }]}>
      <Text style={s.kvK}>{k}</Text>
      {typeof v === "string" || typeof v === "number" ? <Text style={[s.kvV, mono && { fontFamily: F.mono, fontSize: 13 }]} numberOfLines={2}>{v}</Text> : v}
    </View>
  );
}

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: IconName }) {
  const C = useTheme(); const s = useStyles(); const t = tones(C)[tone];
  return <View style={[s.badge, { backgroundColor: t.bg }]}>{icon ? <Icon name={icon} size={12} color={t.fg} /> : null}<Text style={[s.badgeText, { color: t.fg }]}>{children}</Text></View>;
}
export const TierBadge = ({ tier }: { tier: Tier }) => <Badge tone={tier === Tier.LOW ? "ok" : tier === Tier.HIGH ? "warn" : "bad"}>{TIER_LABELS[tier]}</Badge>;
export const ModeBadge = ({ mode }: { mode: Mode }) => <Badge tone={mode === Mode.NORMAL ? "ok" : mode === Mode.ELEVATED ? "warn" : "bad"} icon="shield">{MODE_LABELS[mode]}</Badge>;
export const StatusBadge = ({ status }: { status: Status }) => <Badge tone={status === Status.EXECUTED ? "ok" : status === Status.PENDING ? "warn" : status === Status.VETOED ? "bad" : "neutral"}>{STATUS_LABELS[status]}</Badge>;
export const TrustBadge = ({ trust }: { trust: Trust }) => <Badge tone={trust === Trust.BLOCKED || trust === Trust.RESTRICTED ? "bad" : trust === Trust.NEW || trust === Trust.UNKNOWN ? "info" : "ok"}>{TRUST_LABELS[trust]}</Badge>;

export function Button({ children, onPress, kind = "primary", disabled, loading, icon, style, size = "md", testID }: { children: ReactNode; onPress?: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; size?: "md" | "sm"; testID?: string }) {
  const C = useTheme(); const s = useStyles();
  const bg = kind === "primary" ? C.accent : kind === "danger" ? C.errorBg : kind === "secondary" ? C.card2 : "transparent";
  const fg = kind === "primary" ? C.onAccent : kind === "danger" ? C.error : C.text;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={typeof children === "string" ? children : undefined} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.btn, size === "sm" && { height: 36, paddingHorizontal: 14 }, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon ? <Icon name={icon} size={16} color={fg} /> : null}<Text style={[s.btnText, size === "sm" && { fontSize: 13 }, { color: fg }]}>{children}</Text></>}
    </Pressable>
  );
}

/** The sticky primary action: what you are about to sign, and with which key. */
export function SignBar({ label, signerAddress, onPress, disabled, loading, hint }: { label: string; signerAddress?: string | null; onPress?: () => void; disabled?: boolean; loading?: boolean; hint?: string }) {
  const C = useTheme(); const s = useStyles();
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
  const s = useStyles();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { mono?: boolean; big?: boolean }>(function Input(props, ref) {
  const C = useTheme(); const s = useStyles();
  return <TextInput ref={ref} placeholderTextColor={C.text3} autoCapitalize="none" autoCorrect={false} {...props} style={[s.input, props.mono && { fontFamily: F.mono, fontSize: 13 }, props.big && { fontFamily: F.display, fontSize: 34, height: 64, textAlign: "center", borderWidth: 0, backgroundColor: "transparent" }, props.style]} />;
});

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  const C = useTheme(); const s = useStyles();
  return (
    <View style={s.tabs}>
      {options.map(([v, label]) => (
        <Pressable key={v} accessibilityRole="button" accessibilityLabel={label} onPress={() => onChange(v)} style={[s.tab, value === v && { borderBottomColor: C.accent }]}><Text style={[s.tabText, value === v && { color: C.text }]}>{label}</Text></Pressable>
      ))}
    </View>
  );
}

export function Address({ value, full = false, style }: { value: string; full?: boolean; style?: object }) {
  const C = useTheme(); const s = useStyles();
  const [copied, setCopied] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Copy address" onPress={async () => { await Clipboard.setStringAsync(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={[s.addr, style]} numberOfLines={full ? 2 : 1}>{full ? value : short(value)}</Text>
      <Icon name={copied ? "check" : "copy"} size={13} color={copied ? C.success : C.text3} />
    </Pressable>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const C = useTheme(); const s = useStyles(); const t = tones(C)[tone];
  return <View style={[s.notice, { backgroundColor: t.bg }]}><Text style={{ color: t.fg, fontFamily: F.body, fontSize: 14, lineHeight: 20 }}>{children}</Text></View>;
}

/**
 * A transaction, step by step. "Working…" tells a person nothing when the thing working is their
 * money; which step it is on tells them what is left and roughly how long.
 */
const TX_STEPS: [TxState['phase'], string][] = [
  ['unlocking', 'Unlock the key'],
  ['signing', 'Sign and send'],
  ['waiting', 'Settle on the network'],
];

export function TxProgress({ state }: { state: TxState }) {
  const C = useTheme();
  if (state.phase === 'idle') return null;
  if (state.phase === 'cancelled') return <Notice tone="neutral">Cancelled.</Notice>;
  if (state.phase === 'error') return <Notice tone="bad">{state.message}</Notice>;
  if (state.phase === 'done') {
    return <Notice tone="ok">Executed · {short(state.digest, 6)}</Notice>;
  }
  const current = TX_STEPS.findIndex(([phase]) => phase === state.phase);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Transaction in progress: ${TX_STEPS[current]?.[1] ?? ''}`}
      style={{ backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 12, gap: 7 }}
    >
      {TX_STEPS.map(([phase, label], i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            {active ? (
              <ActivityIndicator size={13} color={C.text2} />
            ) : (
              <Icon name={done ? 'check-circle' : 'circle'} size={13} color={done ? C.success : C.text3} />
            )}
            <Text style={{ fontFamily: active ? F.bodyMedium : F.body, fontSize: 13, color: done ? C.success : active ? C.text : C.text3 }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Kept as the compact single-line form, for places a step list will not fit. */
export function TxStatus({ state }: { state: TxState }) {
  return <TxProgress state={state} />;
}

/**
 * A failed read, with the way out. "Error" with no retry makes the person restart the app, which
 * works by accident and teaches them the app is flaky.
 */
export function ErrorState({
  title = 'Could not reach the vault',
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const C = useTheme();
  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 12 }}>
      <CircleIcon name="cloud-off" size={48} tone="bad" />
      <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: C.text, textAlign: 'center' }}>{title}</Text>
      {detail ? (
        <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2, textAlign: 'center' }}>
          {detail}
        </Text>
      ) : null}
      {onRetry ? (
        <Button kind="secondary" size="sm" icon="refresh-cw" onPress={onRetry} testID="retry">
          Try again
        </Button>
      ) : null}
    </View>
  );
}

/** Placeholder blocks while a read is in flight, so the layout arrives before the numbers do. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  const C = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          style={{
            height: i === 0 ? 24 : 14,
            borderRadius: 6,
            backgroundColor: C.card2,
            width: `${[62, 94, 78, 88, 70][i % 5]}%`,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Shown when the device believes it is offline. The data on screen is the cache, which is worth
 * far more than a spinner — as long as its age is stated rather than implied.
 */
export function OfflineBanner({ asOf }: { asOf?: number }) {
  const C = useTheme();
  const age =
    asOf && asOf > 0
      ? ` — showing the vault as of ${new Date(asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : '';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: C.warningBg, paddingVertical: 7, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Icon name="wifi-off" size={13} color={C.warning} />
      <Text style={{ fontFamily: F.bodyMedium, fontSize: 12.5, color: C.warning, flex: 1 }}>
        Offline{age}
      </Text>
    </View>
  );
}

export function Empty({ icon = "inbox", children }: { icon?: IconName; children: ReactNode }) {
  const C = useTheme();
  return <View style={{ padding: 32, alignItems: "center", gap: 12 }}><CircleIcon name={icon} size={48} /><Text style={{ color: C.text2, fontFamily: F.body, textAlign: "center", lineHeight: 20 }}>{children}</Text></View>;
}

/** Caution tape: the brand's mark, used only where the vault is not in Normal mode. */
export function Tape({ height = 8 }: { height?: number }) {
  const C = useTheme();
  return (
    <View style={{ height, flexDirection: "row", overflow: "hidden" }}>
      {Array.from({ length: 34 }).map((_, i) => <View key={i} style={{ width: 14, backgroundColor: i % 2 ? C.canvas : C.accent, transform: [{ skewX: "-45deg" }] }} />)}
    </View>
  );
}

export function Sheet({ open, onClose, title, children, action }: { open: boolean; onClose: () => void; title: string; children: ReactNode; action?: ReactNode }) {
  const s = useStyles(); const insets = useSafeAreaInsets();
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

const makeStyles = (C: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  topbar: { height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { fontFamily: F.display, fontSize: 22, color: C.text, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.canvas },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, marginBottom: 12 },
  sectionLabel: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.text3, marginBottom: 8, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
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
  signerChip: { backgroundColor: "rgba(16,20,24,0.12)", borderRadius: R.pill, paddingHorizontal: 10, height: 28, justifyContent: "center" },
  signerChipText: { fontFamily: F.monoMedium, fontSize: 12, color: C.onAccent },
  label: { fontFamily: F.bodyMedium, fontSize: 13, color: C.text2, marginBottom: 6 },
  hint: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 6, lineHeight: 16 },
  input: { backgroundColor: C.card2, borderRadius: R.md, paddingHorizontal: 14, height: 48, color: C.text, fontFamily: F.body, fontSize: 15, borderWidth: 1, borderColor: C.border },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginBottom: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 22, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: F.bodyBold, fontSize: 15, color: C.text3 },
  addr: { fontFamily: F.mono, fontSize: 13, color: C.text2 },
  notice: { padding: 12, borderRadius: R.md, marginTop: 10 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontFamily: F.display, fontSize: 18, color: C.text },
});

const cache = new Map<string, ReturnType<typeof makeStyles>>();
/** Styles for the ground currently in use, built once per palette. */
export function useStyles() {
  const C = useTheme();
  if (!cache.has(C.canvas)) cache.set(C.canvas, makeStyles(C));
  return cache.get(C.canvas)!;
}
