import { formatUnits, parseUnits } from "viem";

export function short(addr: string, n = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}

export function fmtAmount(value: bigint, decimals: number, symbol?: string, maxFrac = 2): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ""] = s.split(".");
  const intFmt = Number(int).toLocaleString("en-US");
  const fracTrim = frac.slice(0, maxFrac).replace(/0+$/, "");
  const out = fracTrim ? `${intFmt}.${fracTrim}` : intFmt;
  return symbol ? `${out} ${symbol}` : out;
}

export function parseAmount(text: string, decimals: number): bigint | null {
  try {
    const cleaned = text.replace(/,/g, "").trim();
    if (!cleaned) return null;
    return parseUnits(cleaned, decimals);
  } catch {
    return null;
  }
}

export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "none";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  return parts.join(" ") || `${seconds}s`;
}

export function fmtDate(ts: bigint | number): string {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtRelative(ts: bigint | number, now = Date.now() / 1000): string {
  const n = Number(ts);
  if (!n) return "—";
  const diff = n - now;
  if (Math.abs(diff) < 60) return diff >= 0 ? "now" : "just now";
  const abs = fmtDuration(Math.abs(Math.round(diff)));
  return diff > 0 ? `in ${abs}` : `${abs} ago`;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
