/**
 * Formatting for amounts, durations and shares. No chain dependency: the EVM build imported these
 * from viem, which is why they are implemented here instead.
 *
 * Durations are milliseconds throughout, matching `sui::clock`.
 */

export function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  const frac = abs % base;
  const fracText = decimals === 0 ? '' : frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int}${fracText ? `.${fracText}` : ''}`;
}

export function parseUnits(text: string, decimals: number): bigint | null {
  const cleaned = text.replace(/[, _]/g, '').trim();
  if (!cleaned || !/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const neg = cleaned.startsWith('-');
  const body = neg ? cleaned.slice(1) : cleaned;
  const [int = '0', frac = ''] = body.split('.');
  if (frac.length > decimals) return null;
  const scaled = BigInt(int || '0') * 10n ** BigInt(decimals) + BigInt((frac || '0').padEnd(decimals, '0') || '0');
  return neg ? -scaled : scaled;
}

export function short(addr: string, n = 4): string {
  if (!addr) return '';
  if (addr.length <= 2 * n + 3) return addr;
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}

export function fmtAmount(value: bigint, decimals: number, symbol?: string, maxFrac = 2): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  const intFmt = Number(int).toLocaleString('en-US');
  const fracTrim = frac.slice(0, maxFrac).replace(/0+$/, '');
  const out = fracTrim ? `${intFmt}.${fracTrim}` : intFmt;
  return symbol ? `${out} ${symbol}` : out;
}

export function parseAmount(text: string, decimals: number): bigint | null {
  const v = parseUnits(text, decimals);
  return v === null || v < 0n ? null : v;
}

export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

/** Milliseconds to something a person reads. */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return 'none';
  const totalMinutes = Math.floor(ms / 60_000);
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  return parts.join(' ') || `${Math.round(ms / 1000)}s`;
}

export function fmtTimestamp(ms: number | bigint): string {
  const n = Number(ms);
  if (!n) return '—';
  return new Date(n).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtRelative(ms: number | bigint, now = Date.now()): string {
  const n = Number(ms);
  if (!n) return '—';
  const diff = n - now;
  if (Math.abs(diff) < 60_000) return diff >= 0 ? 'now' : 'just now';
  const abs = fmtDuration(Math.abs(diff));
  return diff > 0 ? `in ${abs}` : `${abs} ago`;
}
