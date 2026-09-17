import { tokenMark } from "../lib/tokens";

type Variant = "home" | "queue" | "confirm";

const TOKENS: Array<[string, string, string]> = [
  ["sUSD", "250,000", "0 of 100,000 today"],
  ["KASH", "3", "0 of 5,000 today"],
  ["sEUR", "84,500", "0 of 100,000 today"],
  ["sBTC", "3.42", "0 of 50 today"],
];

/**
 * The phone app, drawn at true device scale (393 x 852) and scaled as a unit, so the type sizes and
 * spacing are the app's own rather than a squeezed approximation.
 */
export function PhoneMockup({ variant = "home", width = 268, label }: { variant?: Variant; width?: number; label?: string }) {
  return (
    <div className="phone" style={{ ["--pwn" as string]: width }} aria-label={label ?? `Skur on a phone, ${variant}`}>
      <div className="phone-device">
        <div className="phone-screen">
          <StatusBar />
          <div className="ph-body">{variant === "home" ? <Home /> : variant === "queue" ? <Queue /> : <Confirm />}</div>
          {variant === "confirm" ? null : <TabBar active={variant === "home" ? 0 : 1} />}
          <span className="ph-home-ind" />
        </div>
        <span className="ph-island" />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="ph-status">
      <b>9:41</b>
      <span className="ph-status-icons">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden><path d="M8 11.2 1 4.6a10 10 0 0 1 14 0L8 11.2Z" opacity=".95" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="18" height="8" rx="2" /><path d="M23 4v4a2.5 2.5 0 0 0 0-4Z" opacity=".4" /></svg>
      </span>
    </div>
  );
}

function TabBar({ active }: { active: number }) {
  return (
    <div className="ph-tabs">
      {["⌂", "⇄", "⚙"].map((g, i) => (
        <span key={g} className={i === active ? "on" : ""}>
          {g}
          {i === 1 ? <i className="ph-tab-badge">1</i> : null}
        </span>
      ))}
    </div>
  );
}

function Mark({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const m = tokenMark(symbol);
  return <span className="ph-mark" style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size * 0.46 }}>{m.glyph}</span>;
}

function Home() {
  return (
    <>
      <div className="ph-top">
        <span className="ph-ident"><i>1/2</i></span>
        <b>Treasury vault</b><span className="ph-caret">⌄</span>
        <span className="ph-top-btns"><i /><i className="bell" /></span>
      </div>
      <div className="ph-pending"><span className="n">1</span>Pending transactions<span className="ph-caret r">›</span></div>
      <div className="ph-chain"><span className="ph-ark">A</span><b>Ark devnet</b><small>0xD3f0…ED52</small></div>
      <div className="ph-balance">250,000<small>sUSD</small></div>
      <div className="ph-actions"><span className="go">↗ Send</span><span>↙ Receive</span></div>
      <div className="ph-label">Tokens</div>
      {TOKENS.map(([sym, amt, sub]) => (
        <div className="ph-row" key={sym}>
          <Mark symbol={sym} />
          <span className="ph-name"><b>{tokenMark(sym).name}</b><small>{sub}</small></span>
          <b className="ph-amt">{amt}</b>
        </div>
      ))}
    </>
  );
}

function Queue() {
  return (
    <>
      <div className="ph-title">Transactions<span className="ph-plus">+</span></div>
      <div className="ph-tabsline"><b>Queue · 2</b><span>History</span></div>
      <div className="ph-chips"><b>All types</b><span>Transfers</span><span>Governance</span></div>
      <div className="ph-label">Sep 17, 2026</div>
      <div className="ph-card">
        {[["↗", "Send", "12,000 sUSD to 0x7c4f…41e2", "1 of 2"], ["≡", "Policy update", "tightens every control", "0 of 1"]].map(([g, t, d, s], i) => (
          <div className={`ph-row ${i === 1 ? "last" : ""}`} key={t}>
            <span className="ph-circle">{g}</span>
            <span className="ph-name"><b>{t}</b><small>{d}</small></span>
            <span className="ph-badge warn">{s}</span>
            <span className="ph-caret r">›</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Confirm() {
  return (
    <>
      <div className="ph-title back"><span className="ph-circle sm">←</span>Confirm transaction</div>
      <div className="ph-hero">
        <span className="ph-hero-mark"><Mark symbol="sUSD" size={64} /><i>↗</i></span>
        <b>−12,000 sUSD</b>
        <small>Send · to 0x7c4f…41e2</small>
        <span className="ph-badge warn">1 of 2 confirmations</span>
      </div>
      <div className="ph-card pad">
        <div className="ph-kv"><span>To</span><b>0x7c4f…41e2</b></div>
        <div className="ph-kv"><span>Purpose</span><b>Invoice 1042</b></div>
        <div className="ph-kv last"><span>Network</span><b>Ark devnet · 9000</b></div>
      </div>
      <div className="ph-card">
        <div className="ph-row"><span className="ph-circle">⛨</span><span className="ph-name"><b>Risk review</b><small>never paid · above routine</small></span><span className="ph-badge warn">High</span><span className="ph-caret r">›</span></div>
        <div className="ph-row last"><span className="ph-circle">◎</span><span className="ph-name"><b>Confirmations</b><small>one more signer needed</small></span><span className="ph-badge">1/2</span><span className="ph-caret r">›</span></div>
      </div>
      <div className="ph-sign">✎<b>Confirm</b><span className="who">0x4FEA…EEc0</span>›</div>
    </>
  );
}
