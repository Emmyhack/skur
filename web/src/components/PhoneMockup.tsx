import { tokenMark } from "../lib/tokens";

type Variant = "home" | "queue" | "confirm";

const TOKENS: Array<[string, string]> = [
  ["sUSD", "250,000"],
  ["KASH", "3"],
  ["sEUR", "84,500"],
  ["sBTC", "3.42"],
  ["sETH", "12.4"],
];

/** The phone app, drawn rather than screenshotted, so it stays sharp and follows the design system. */
export function PhoneMockup({ variant = "home", label }: { variant?: Variant; label?: string }) {
  return (
    <div className="phone" aria-label={label ?? `Skur mobile, ${variant}`}>
      <div className="phone-frame">
        <span className="notch" />
        <div className="phone-screen">{variant === "home" ? <Home /> : variant === "queue" ? <Queue /> : <Confirm />}</div>
      </div>
    </div>
  );
}

function Mark({ symbol, size = 26 }: { symbol: string; size?: number }) {
  const m = tokenMark(symbol);
  return <span className="p-mark" style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size * 0.46 }}>{m.glyph}</span>;
}

function Home() {
  return (
    <>
      <div className="p-top">
        <span className="p-ident" /><b>Treasury vault</b><span className="p-chev">⌄</span>
        <span className="p-icons"><i /><i className="dot" /></span>
      </div>
      <div className="p-banner"><span className="n">1</span>Pending transactions<span className="p-chev">›</span></div>
      <div className="p-chain"><span className="p-a">A</span>Ark devnet<small>0xD3f0…ED52</small></div>
      <div className="p-balance">250,000<small>sUSD</small></div>
      <div className="p-actions"><span className="go">↗ Send</span><span>↙ Receive</span></div>
      <div className="p-label">Tokens</div>
      {TOKENS.slice(0, 4).map(([sym, amt]) => (
        <div className="p-row" key={sym}>
          <Mark symbol={sym} />
          <span className="p-name">{tokenMark(sym).name}<small>0 of cap today</small></span>
          <b>{amt}</b>
        </div>
      ))}
    </>
  );
}

function Queue() {
  return (
    <>
      <div className="p-title">Transactions<span className="p-plus">+</span></div>
      <div className="p-tabs"><b>Queue · 2</b><span>History</span></div>
      <div className="p-chips"><b>All types</b><span>Transfers</span><span>Governance</span></div>
      <div className="p-label">Sep 17, 2026</div>
      {[["↗", "Send", "12,000 sUSD to 0x7c4f…41e2", "1 of 2", "warn"], ["≡", "Policy update", "tightens every control", "0 of 1", "warn"]].map(([g, t, d, s, tone]) => (
        <div className="p-row" key={t}>
          <span className="p-circle">{g}</span>
          <span className="p-name">{t}<small>{d}</small></span>
          <span className={`p-badge ${tone}`}>{s}</span>
        </div>
      ))}
    </>
  );
}

function Confirm() {
  return (
    <>
      <div className="p-title back"><span className="p-circle sm">←</span>Confirm</div>
      <div className="p-hero">
        <Mark symbol="sUSD" size={46} />
        <b>−12,000 sUSD</b>
        <small>to 0x7c4f…41e2 · just now</small>
        <span className="p-badge warn">1 of 2</span>
      </div>
      <div className="p-card">
        <div className="p-kv"><span>To</span><b>0x7c4f…41e2</b></div>
        <div className="p-kv"><span>Network</span><b>Ark devnet</b></div>
      </div>
      <div className="p-row tight"><span className="p-circle">⛨</span><span className="p-name">Risk review<small>new recipient · above routine</small></span><span className="p-badge warn">High</span></div>
      <div className="p-row tight"><span className="p-circle">◎</span><span className="p-name">Confirmations<small>waiting for one more</small></span><span className="p-badge">1/2</span></div>
      <div className="p-sign">✎ Confirm<span className="who">0x4FEA…EEc0</span>›</div>
    </>
  );
}
