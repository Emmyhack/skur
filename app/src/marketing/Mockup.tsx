'use client';

/** Static miniature of the app used as artwork on the landing page, the way safe.global shows its dashboard. */
export function AppMockup({ variant = "overview" }: { variant?: "overview" | "queue" | "policy" }) {
  return (
    <div className="mock-app" aria-hidden>
      <div className="sb">
        <div className="pill">S &nbsp;Home</div>
        <div className="ntx">+ New transaction</div>
        {["Overview", "Queue", "Pay", "Policy", "People", "Security"].map((n, i) => (
          <div key={n} className={`it ${(variant === "queue" ? i === 2 : i === 0) ? "on" : ""}`}>{n}</div>
        ))}
        <div className="it" style={{ color: "#a1a3a7", marginTop: 8 }}>Security</div>
        {["Templates", "Simulator", "Max loss"].map((n) => (
          <div key={n} className={`it ${variant === "policy" && n === "Simulator" ? "on" : ""}`}>{n}</div>
        ))}
      </div>
      <div className="ct">
        <div className="acct">
          <span className="ident" />
          <span><b>Main treasury</b><br /><span style={{ color: "#a1a3a7" }}>0xa91c…42dc</span></span>
          <span style={{ marginLeft: "auto", color: "#a1a3a7" }}>2/3 · <b style={{ color: "#fff" }}>250,000 USDC</b> · <span className="ok">Normal</span></span>
        </div>
        {variant === "overview" && (
          <>
            <div className="pn">
              <div style={{ color: "#a1a3a7" }}>Total balance</div>
              <div className="big">250,000<span>.00 USDC</span></div>
              <span className="mb">↗ Send</span><span className="mb">⌗ Receive</span>
              <div style={{ marginTop: 14, color: "#a1a3a7" }}>Top assets</div>
              <div className="li"><span>$ USDC</span><span>250,000</span></div>
              <div className="li"><span>S SUI</span><span>1,240</span></div>
            </div>
            <div className="pn">
              <div style={{ fontWeight: 700 }}>Pending transactions</div>
              <div className="li"><span>Pay 12,000 USDC</span><span className="rv">1 out of 2</span></div>
              <div className="li"><span>Pay 900 USDC</span><span className="ok">✓ 1 out of 1</span></div>
              <div className="li"><span>Update policy</span><span className="rv">⏱ 1d timelock</span></div>
            </div>
          </>
        )}
        {variant === "queue" && (
          <div className="pn" style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 700, color: "var(--accent)", borderBottom: "2px solid var(--accent)", display: "inline-block", paddingBottom: 6 }}>Queue</div>
            <div className="li"><span>↗ Pay 12,000 USDC to 0x4F…a1c2</span><span className="rv">High risk · 1 out of 2</span></div>
            <div className="li"><span>↗ Pay 60,000 USDC to 0x9bd2…77e0</span><span className="rv">Critical · guardian · 1d</span></div>
            <div className="li"><span>⚙ Lower approvals to 1</span><span className="rv">Weakens the vault · vetoable</span></div>
            <div className="li"><span>🤖 Agent: pay 2,400 USDC (invoice 1182)</span><span className="rv">Routine · needs 1 human</span></div>
          </div>
        )}
        {variant === "policy" && (
          <div className="pn" style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 700 }}>Policy simulator</div>
            <div className="li"><span>One finance signer compromised</span><span className="ok">Blocked</span></div>
            <div className="li"><span>Drain split into twenty transfers</span><span className="ok">Blocked</span></div>
            <div className="li"><span>Attacker weakens policy, then withdraws</span><span className="ok">Delayed 1d</span></div>
            <div className="li"><span>Guardian key compromised</span><span className="ok">Not possible</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
