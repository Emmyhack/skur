import type { ReactNode } from 'react';
import { Switch, Text, View } from 'react-native';
import { Icon, type IconName } from './ui';
import { useTheme } from '../state/theme';
import { F, R } from '../theme';

/**
 * The pieces the product screens are drawn with, beyond the base kit in ui.tsx: checklists,
 * meters, bars, avatars, pager dots and timelines. Pure presentation — nothing here reads the
 * chain or holds state.
 */

/** A green-check feature or control line, used by the tour, the security center and sign review. */
export function CheckItem({
  title,
  detail,
  ok = true,
  icon,
}: {
  title: string;
  detail?: string;
  ok?: boolean | 'warn';
  icon?: IconName;
}) {
  const C = useTheme();
  const color = ok === true ? C.success : ok === 'warn' ? C.warning : C.error;
  const name: IconName = icon ?? (ok === true ? 'check-circle' : ok === 'warn' ? 'alert-circle' : 'x-circle');
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: detail ? 'flex-start' : 'center', paddingVertical: 8 }}>
      <View style={{ paddingTop: detail ? 2 : 0 }}>
        <Icon name={name} size={18} color={color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text }}>{title}</Text>
        {detail ? (
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2 }}>{detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** A settings row with a switch on the right. */
export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: IconName;
}) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      {icon ? <Icon name={icon} size={18} color={C.text2} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.text2 }}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.accent, false: C.card2 }}
        thumbColor={value ? C.onAccent : C.text3}
        accessibilityLabel={title}
      />
    </View>
  );
}

/** A labelled progress meter: posture, approvals collected, budget used. 0..1. */
export function Meter({ value, label, trailing }: { value: number; label?: string; trailing?: string }) {
  const C = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ gap: 6 }}>
      {label || trailing ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {label ? <Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: C.text2 }}>{label}</Text> : <View />}
          {trailing ? <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.text }}>{trailing}</Text> : null}
        </View>
      ) : null}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.card2, overflow: 'hidden' }}>
        <View style={{ width: `${clamped * 100}%`, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
      </View>
    </View>
  );
}

export type Slice = { label: string; value: number; color: string };

/** One stacked bar for the whole portfolio, with a legend — the honest cousin of a donut. */
export function PortfolioBar({ slices }: { slices: Slice[] }) {
  const C = useTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.card2 }}>
        {slices.map((s) => (
          <View key={s.label} style={{ flex: s.value / total, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={{ gap: 6 }}>
        {slices.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ flex: 1, fontFamily: F.bodyMedium, fontSize: 14, color: C.text }}>{s.label}</Text>
            <Text style={{ fontFamily: F.monoMedium, fontSize: 13, color: C.text2 }}>
              {((s.value / total) * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Vertical bars, one per item, scaled to the largest. */
export function BarChart({ items }: { items: { label: string; value: number }[] }) {
  const C = useTheme();
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, height: 96, paddingTop: 8 }}>
      {items.map((i) => (
        <View key={i.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <View
            style={{
              width: '100%',
              maxWidth: 36,
              height: Math.max(6, (i.value / max) * 72),
              borderRadius: 6,
              backgroundColor: C.accent,
            }}
          />
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.text3 }} numberOfLines={1}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Initials in a circle, for people the chain only knows as addresses. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const C = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.accentBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: F.bodyBold, fontSize: size * 0.4, color: C.text }}>{initials || '•'}</Text>
    </View>
  );
}

/** Pager dots for the tour. */
export function Dots({ count, index }: { count: number; index: number }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === index ? C.accent : C.card2,
          }}
        />
      ))}
    </View>
  );
}

/**
 * One step on an approval timeline. The rail is drawn by the items themselves so the line never
 * outruns the content.
 */
export function TimelineStep({
  title,
  subtitle,
  state,
  last = false,
  trailing,
}: {
  title: string;
  subtitle?: ReactNode;
  state: 'done' | 'active' | 'todo';
  last?: boolean;
  trailing?: ReactNode;
}) {
  const C = useTheme();
  const color = state === 'done' ? C.success : state === 'active' ? C.accent : C.text3;
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center', width: 20 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: color,
            backgroundColor: state === 'done' ? C.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {state === 'done' ? <Icon name="check" size={11} color={C.canvas} /> : null}
        </View>
        {!last ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: C.border, marginVertical: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 16, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text }}>{title}</Text>
          {trailing}
        </View>
        {subtitle ? (
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.text2 }}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** A big stat with a caption, for the dashboard's value and count cards. */
export function Stat({ value, label, tone }: { value: string; label: string; tone?: 'accent' | 'plain' }) {
  const C = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tone === 'accent' ? C.accentBg : C.card,
        borderRadius: R.lg,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: F.display, fontSize: 24, color: C.text }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ fontFamily: F.body, fontSize: 12, color: C.text2 }}>{label}</Text>
    </View>
  );
}
