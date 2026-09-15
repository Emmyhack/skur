import { useEffect, useState } from "react";

type Sample = { amt: string; to: string; tier: "low" | "high" | "critical" | "blocked"; label: string; why: string[] };

const SAMPLES: Sample[] = [
  { amt: "1,000 sUSD", to: "Design retainer · verified", tier: "low", label: "LOW · 1 approval · executes now", why: ["Below the routine threshold", "Recipient verified, paid 14 times before", "Uses 3% of today's cap"] },
  { amt: "12,000 sUSD", to: "0x7c4f…41e2 · never paid", tier: "high", label: "HIGH · 2 approvals · waits 24h", why: ["Above the routine threshold", "This vault has never paid the address", "Activation delay applies; any guardian can veto"] },
  { amt: "60,000 sUSD", to: "Exchange deposit · verified", tier: "critical", label: "CRITICAL · 2 + guardian · 24h", why: ["24% of holdings in one payment", "Above the high threshold", "Needs a guardian; any guardian can veto"] },
  { amt: "9,900 sUSD × 20", to: "Split across one day", tier: "blocked", label: "BLOCKED · circuit breaker", why: ["Outflow is counted cumulatively", "Loss envelope crossed on payment 11", "Vault enters Lockdown instead of paying"] },
];

/** Live scorer for the hero: cycles through sample payments and shows how the vault would tier each one. */
export function ScoreTicker() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"scoring" | "done">(reduced ? "done" : "scoring");
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setPhase("done"), phase === "scoring" ? 1100 : 3400);
    if (phase === "done") {
      const n = setTimeout(() => { setI((x) => (x + 1) % SAMPLES.length); setPhase("scoring"); }, 3400);
      return () => { clearTimeout(t); clearTimeout(n); };
    }
    return () => clearTimeout(t);
  }, [phase, reduced]);
  const s = SAMPLES[i];
  return (
    <div className="ticker" aria-label="Example of how the vault scores payments">
      <div className="head"><span>Risk engine · <b>live preview</b></span><span>Policy v3 · Normal</span></div>
      <div className="body">
        <div className="row"><span>Payment</span><span className="amt">{s.amt}</span></div>
        <div className="row"><span>Recipient</span><span className="to">{s.to}</span></div>
        <div className={`prog ${phase === "scoring" ? "on" : "done"}`}><i /></div>
        <div className="verdict">
          {phase === "scoring" ? <span className="scoring">Scoring against policy…</span> : <span key={`${i}-tier`} className={`tier ${s.tier}`}>{s.label}</span>}
        </div>
        <ul className="why">
          {phase === "done" && s.why.map((w, k) => <li key={`${i}-${k}`} style={{ animationDelay: `${k * 0.12}s` }}>{w}</li>)}
        </ul>
      </div>
      <div className="foot">
        <span>Requirements are pinned at proposal and checked again at execution.</span>
        <span className="dots">{SAMPLES.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</span>
      </div>
    </div>
  );
}
