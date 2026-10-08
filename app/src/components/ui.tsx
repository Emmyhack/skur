'use client';

import { useEffect, useState } from 'react';
import {
  MODE_LABELS,
  Mode,
  STATUS_LABELS,
  Status,
  TIER_LABELS,
  Tier,
  TRUST_LABELS,
  Trust,
  describeRoles,
  fmtAmount,
  short,
} from '@skur/sdk';
import { EXPLORER } from '@/config';

export function TierPill({ tier }: { tier: Tier }) {
  const cls = tier === Tier.CRITICAL ? 'critical' : tier === Tier.HIGH ? 'high' : 'low';
  return <span className={`pill ${cls}`}>{TIER_LABELS[tier]}</span>;
}

export function ModePill({ mode }: { mode: Mode }) {
  const cls = mode === Mode.LOCKDOWN ? 'critical' : mode === Mode.ELEVATED ? 'high' : 'low';
  return <span className={`pill ${cls}`}>{MODE_LABELS[mode]}</span>;
}

export function StatusPill({ status }: { status: Status }) {
  const cls =
    status === Status.EXECUTED
      ? 'low'
      : status === Status.PENDING
        ? ''
        : status === Status.BLOCKED || status === Status.VETOED
          ? 'critical'
          : 'high';
  return <span className={`pill ${cls}`}>{STATUS_LABELS[status]}</span>;
}

export function TrustPill({ trust }: { trust: Trust }) {
  const cls =
    trust === Trust.BLOCKED || trust === Trust.RESTRICTED
      ? 'critical'
      : trust === Trust.TRUSTED || trust === Trust.VERIFIED
        ? 'low'
        : 'high';
  return <span className={`pill ${cls}`}>{TRUST_LABELS[trust]}</span>;
}

export function Roles({ bits }: { bits: number }) {
  const names = describeRoles(bits);
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {names.length === 0 ? <span className="faint small">none</span> : null}
      {names.map((n) => (
        <span key={n} className="pill">
          {n}
        </span>
      ))}
    </span>
  );
}

export function Addr({ value, label }: { value: string; label?: string }) {
  return (
    <a
      className="mono"
      href={EXPLORER('object', value)}
      target="_blank"
      rel="noreferrer"
      title={value}
      style={{ textDecoration: 'none' }}
    >
      {label ? `${label} · ` : ''}
      {short(value, 6)}
    </a>
  );
}

/** A coin type is long and mostly noise; the struct name is what a person recognises. */
export function coinSymbol(coinType: string): string {
  const name = coinType.split('::').pop() ?? coinType;
  return name.toUpperCase();
}

/** Decimals are a property of the coin's metadata; these are the ones we can know without a read. */
const KNOWN_DECIMALS: Record<string, number> = { SUI: 9, USDC: 6, USDT: 6, USDSUI: 6 };

export function coinDecimals(coinType: string): number {
  return KNOWN_DECIMALS[coinSymbol(coinType)] ?? 9;
}

export function Amount({ value, coinType }: { value: bigint; coinType: string }) {
  return <span>{fmtAmount(value, coinDecimals(coinType), coinSymbol(coinType))}</span>;
}

export function Notice({
  kind = 'warn',
  children,
}: {
  kind?: 'warn' | 'bad' | 'ok' | 'plain';
  children: React.ReactNode;
}) {
  return <div className={`notice ${kind === 'plain' ? '' : kind}`}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Light, dark or whatever the system says, remembered per browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('skur.theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved);
    } catch {
      // Private windows and blocked site data throw here. The default is fine.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('skur.theme', theme);
    } catch {
      // Not being able to remember the choice is not a reason to fail to apply it.
    }
  }, [theme]);

  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const glyph = theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐';
  return (
    <button className="btn sm ghost" onClick={() => setTheme(next)} title={`Theme: ${theme}`}>
      {glyph}
    </button>
  );
}

/** A relative time that updates, so "executable in 4m" does not sit there being wrong. */
export function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const left = to - now;
  if (left <= 0) return <span className="small" style={{ color: 'var(--ok)' }}>now</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
  return <span className="small mono">in {text}</span>;
}
