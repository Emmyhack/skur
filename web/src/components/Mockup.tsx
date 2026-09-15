/** Static miniature of the app used as artwork on the landing page, the way safe.global shows its dashboard. */
export function AppMockup({ variant = "overview" }: { variant?: "overview" | "queue" | "policy" }) {
  return (
    <div className="mock-app" aria-hidden>
      <div className="sb">
        <div className="pill">S &nbsp;Home</div>
        <div className="ntx">+ New transaction</div>
        {["Overview", "Assets", "Transactions", "Address book", "Members", "Settings"].map((n, i) => (
          <div key={n} className={`it ${(variant === "queue" ? i === 2 : i === 0) ? "on" : ""}`}>{n}</div>
        ))}
        <div className="it" style={{ color: "#a1a3a7", marginTop: 8 }}>Security</div>
        {["Policies", "Security", "Simulator"].map((n) => (
          <div key={n} className={`it ${variant === "policy" && n === "Policies" ? "on" : ""}`}>{n}</div>
        ))}
      </div>
      <div className="ct">
        <div className="acct">
          <span className="ident" />
          <span><b>Main treasury</b><br /><span style={{ color: "#a1a3a7" }}>ark:0xCC31…42Dc</span></span>
          <span style={{ marginLeft: "auto", color: "#a1a3a7" }}>2/3 · <b style={{ color: "#fff" }}>250,000 sUSD</b> · <span className="ok">Normal</span></span>
        </div>
        {variant === "overview" && (
          <>
            <div className="pn">
              <div style={{ color: "#a1a3a7" }}>Total balance</div>
              <div className="big">250,000<span>.00 sUSD</span></div>
              <span className="mb">↗ Send</span><span className="mb">⌗ Receive</span>
              <div style={{ marginTop: 14, color: "#a1a3a7" }}>Top assets</div>
              <div className="li"><span>$ sUSD</span><span>250,000</span></div>
              <div className="li"><span>K KASH</span><span>2</span></div>
            </div>
            <div className="pn">
              <div style={{ fontWeight: 700 }}>Pending transactions</div>
              <div className="li"><span>Send 12,000 sUSD</span><span className="rv">1 out of 2</span></div>
              <div className="li"><span>Send 900 sUSD</span><span className="ok">✓ 1 out of 1</span></div>
              <div className="li"><span>Update policy</span><span className="rv">⏱ 1d timelock</span></div>
            </div>
          </>
        )}
        {variant === "queue" && (
          <div className="pn" style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 700, color: "var(--accent)", borderBottom: "2px solid var(--accent)", display: "inline-block", paddingBottom: 6 }}>Queue</div>
            <div className="li"><span>↗ Send 12,000 sUSD to 0x4F…a1c2</span><span className="rv">High risk · 1 out of 2</span></div>
            <div className="li"><span>↗ Send 60,000 sUSD to 0x9B…77e0</span><span className="rv">Critical · guardian · 1d</span></div>
            <div className="li"><span>⚙ Lower approvals to 1</span><span className="rv">Security-reducing · vetoable</span></div>
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
