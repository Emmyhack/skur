import { AppMockup } from "../components/Mockup";
import { IconArrowRight, IconCheck, IconChevronRight } from "../components/icons";

/**
 * Public landing page, section for section after safe.global:
 * light nav + announcement, grid hero with the product mockup, "built for" strip, long dark product block
 * (bento, dashed 2x2, verification strip, guard card, comparison table, thesis + stats), then light audience cards,
 * how-it-works, FAQ, CTA on the grid, dark footer with the giant outlined wordmark.
 */
export function Landing({ onLaunch }: { onLaunch: () => void }) {
  const cells = [
    [0, 130], [130, 260], [1180, 0], [1310, 0], [1310, 130], [390, 520], [910, 390], [1050, 260], [780, 650],
  ];
  return (
    <div className="land">
      <header className="land-nav">
        <div className="wrap">
          <a className="logo" href="#/"><span className="mark">S</span><span>Skur<span className="brace">{"{"}</span>Vault<span className="brace">{"}"}</span></span></a>
          <nav>
            <a href="#product">Product</a>
            <a href="#solutions">Solutions</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
          <button className="btn btn-primary" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
        </div>
      </header>
      <div className="announce">
        <a href="#security">Skur V1 is live on Ark Constellation devnet with every control enforced onchain →</a>
      </div>

      <section className="hero">
        <div className="grid-bg" />
        {cells.map(([x, y], i) => <span key={i} className="cell" style={{ left: x, top: y }} />)}
        <div className="wrap">
          <div className="eyebrow"><b>12 INVARIANTS</b> ENFORCED BY THE VAULT CONTRACT</div>
          <h1>Treasury security that assumes compromise</h1>
          <p className="sub">A valid signature proves authorization. It does not prove that a transaction is safe. Skur adds programmable, onchain controls that limit and delay damage even when signers are compromised.</p>
          <button className="btn btn-primary btn-lg" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
          <div className="mock"><AppMockup /></div>
        </div>
      </section>

      <section className="light" style={{ paddingTop: 72 }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 28 }}>Built for onchain businesses</h2>
          <p className="lead" style={{ marginBottom: 32 }}>Skur is a self-custodial vault for startups, protocols, funds, nonprofits and family offices that need more than a signature count between a compromised key and the treasury.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {["Startups", "Protocols & DAOs", "Funds", "Nonprofits", "Family offices", "Finance teams"].map((t) => (
              <span key={t} style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid #dcdee0", background: "#fff", fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="dark" id="product">
        <div className="wrap">
          <h2>Your treasury, full control</h2>
          <p className="lead">Every rule below is a contract, not a server. If the Skur website disappears, the vault and its policy stay exactly as they are.</p>
          <div className="bento">
            <div className="bcard big center">
              <h3>Risk-tiered approvals</h3>
              <p>Every payment is classified LOW, HIGH or CRITICAL from amount, share of holdings, recipient trust, today's outflow and security posture. The tier sets the approvals, the guardian sign-off and the delay.</p>
              <div className="art" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 24, maxWidth: 820, margin: "0 auto" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                  {["1,000 sUSD · supplier", "12,000 sUSD · new address", "60,000 sUSD · 24% of holdings"].map((t) => (
                    <span key={t} style={{ background: "#303033", padding: "10px 16px", borderRadius: 8, fontSize: 14 }}>{t}</span>
                  ))}
                </div>
                <div style={{ width: 96, height: 96, borderRadius: "50%", border: "6px solid #1b2a22", boxShadow: "0 0 0 2px #12ff80 inset", display: "grid", placeItems: "center", background: "#121312", fontWeight: 800, color: "#12ff80" }}>S</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ background: "#12ff80", color: "#121312", padding: "10px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}>Low · 1 approval · now</span>
                  <span style={{ background: "#4a3621", color: "#ffe4cb", padding: "10px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}>High · 2 approvals · waits 1d</span>
                  <span style={{ background: "#4a2125", color: "#ffe0e6", padding: "10px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}>Critical · 2 + guardian · 1d · vetoable</span>
                </div>
              </div>
            </div>
            <div className="bcard">
              <h3>Recipient trust</h3>
              <p>Recipients are security objects, not addresses. A never-seen address waits an activation delay, is escalated a tier and can be vetoed.</p>
              <div className="art" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["New", "activates in 23h", "#203339", "#d9f4fb"], ["Verified", "normal policy", "#173026", "#defdea"], ["Restricted", "always critical", "#4a3621", "#ffe4cb"], ["Blocked", "refused", "#4a2125", "#ffe0e6"]].map(([s, d, bg, fg]) => (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", background: "#121312", padding: "12px 14px", borderRadius: 8 }}><span>0x{s.slice(0, 2).toLowerCase()}4f…a1c2</span><span style={{ background: bg, color: fg, padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{s} · {d}</span></div>
                ))}
              </div>
            </div>
            <div className="bcard">
              <h3>Velocity limits & circuit breaker</h3>
              <p>Outflow is counted cumulatively, so a drain split into twenty transfers hits the same cap. Exceeding the loss envelope freezes the vault instead of paying.</p>
              <div className="art">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#a1a3a7" }}><span>Today's outflow</span><span>98,000 / 100,000 sUSD</span></div>
                <div style={{ height: 10, background: "#303033", borderRadius: 5, margin: "8px 0 16px" }}><div style={{ width: "98%", height: "100%", background: "#ff8c00", borderRadius: 5 }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#a1a3a7" }}><span>Loss envelope (24h)</span><span>25,000 sUSD, then Lockdown</span></div>
                <div style={{ height: 10, background: "#303033", borderRadius: 5, margin: "8px 0" }}><div style={{ width: "40%", height: "100%", background: "#12ff80", borderRadius: 5 }} /></div>
              </div>
            </div>
            <div className="bcard">
              <h3>Independent guardians</h3>
              <p>A separate control plane that can freeze, veto, confirm and recover, and that can never withdraw. Compromising one organisational role is not enough.</p>
              <div className="art" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#121312", borderRadius: 8, padding: 14 }}><div style={{ color: "#a1a3a7", fontSize: 12, marginBottom: 6 }}>Treasury signers</div>Propose · Approve · Execute</div>
                <div style={{ background: "#121312", borderRadius: 8, padding: 14, border: "1px solid #12ff80" }}><div style={{ color: "#12ff80", fontSize: 12, marginBottom: 6 }}>Guardians</div>Freeze · Veto · Recover<br /><span style={{ color: "#a1a3a7", fontSize: 12 }}>never withdraw</span></div>
              </div>
            </div>
            <div className="bcard">
              <h3>Policy simulator</h3>
              <p>Run a policy against the attacks that actually happen before you activate it, with verdicts from the same rules the contract enforces.</p>
              <div className="art"><AppMockup variant="policy" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="dark" id="security" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Business ready crypto security</h2>
          <p className="lead">Defend against key compromise and operate a treasury with controls a finance team can read.</p>
          <div className="dashed">
            <div><h4>No single point of failure</h4><p>Thresholds by risk tier, plus guardians who hold no treasury role. One compromised key, or one compromised role, is not enough.</p></div>
            <div><h4>Enforced onchain, not by a server</h4><p>Limits, delays, vetoes and modes live in the vault contract. Requirements are pinned to each proposal and re-checked at execution.</p></div>
            <div><h4>Open source and verified</h4><p>Source is verified on the Ark explorer and the repository builds to byte-identical bytecode. Twelve invariants are proven by fuzz and stateful tests.</p></div>
            <div><h4>Delayed recovery</h4><p>Guardians can replace a lost signer after a delay that any owner can cancel. Recovery never changes the policy and always leaves the vault in Elevated mode.</p></div>
          </div>
          <div className="badges" style={{ marginTop: 56 }}>
            <span className="lbl">Checked with</span>
            <span>Foundry fuzz & invariants</span>
            <span>Slither</span>
            <span>Blockscout verified</span>
            <span>OpenZeppelin 5</span>
          </div>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="shield">
            <div>
              <h2>Policy-change firewall</h2>
              <p>The configuration plane is as sensitive as the transfer plane. An attacker who can lower a threshold never needs to attack the withdrawal path.</p>
              <ul>
                <li><IconCheck width={22} height={22} /> Security-reducing changes never apply immediately</li>
                <li><IconCheck width={22} height={22} /> Guardians can veto them</li>
                <li><IconCheck width={22} height={22} /> Lockdown blocks them entirely</li>
              </ul>
            </div>
            <div className="tilt"><AppMockup variant="queue" /></div>
          </div>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Not all multisigs are created equal</h2>
          <div className="compare" style={{ marginTop: 40 }}>
            <table>
              <thead>
                <tr><th></th><th className="hl">Skur</th><th>Plain multisig</th><th>Custodial policy engine</th></tr>
              </thead>
              <tbody>
                <tr><td>Authorization</td><td className="hl">Threshold varies with transaction risk</td><td>Fixed N-of-M</td><td>Configurable, offchain</td></tr>
                <tr><td>Enough signers compromised</td><td className="hl">Caps, delays, guardian veto, circuit breaker</td><td>Funds gone</td><td>Depends on provider</td></tr>
                <tr><td>Policy tampering</td><td className="hl">Delayed, vetoable, blocked in Lockdown</td><td>Immediate</td><td>Provider-controlled</td></tr>
                <tr><td>Custody</td><td className="hl">Self-custodial, no backend in the path</td><td>Self-custodial</td><td>Provider holds keys or approvals</td></tr>
                <tr><td>Transparency</td><td className="hl">Every rule and version onchain</td><td>Onchain</td><td>Limited</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap quote">
          <blockquote>"Control not only who can move treasury funds, but how much can move, where it can go, and what happens when risk changes."</blockquote>
          <cite>The Skur security thesis</cite>
          <div className="stats">
            <div><div className="v">12</div><div className="l">Invariants proven</div></div>
            <div><div className="v">95</div><div className="l">Contract tests</div></div>
            <div><div className="v">0</div><div className="l">Backends in the execution path</div></div>
          </div>
        </div>
      </section>

      <section className="light" id="solutions">
        <div className="wrap">
          <h2>Trusted control for organizations and guardians</h2>
          <p className="lead">Two roles, two views. Finance teams operate the treasury; guardians hold the brake.</p>
          <div className="audiences">
            <div className="acard">
              <h3>For finance teams</h3>
              <p>Tiered approvals, recipient trust, velocity caps and a human-readable review before every signature.</p>
              <button className="link" style={{ color: "#12ff80" }} onClick={onLaunch}>Launch app <IconArrowRight width={16} height={16} /></button>
              <div className="art"><AppMockup /></div>
            </div>
            <div className="acard">
              <h3>For guardians</h3>
              <p>Freeze the vault, veto critical or security-reducing proposals, confirm the largest transfers and recover lost signers. Never touch funds.</p>
              <a href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Read the security model <IconArrowRight width={16} height={16} /></a>
              <div className="art"><AppMockup variant="queue" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="white">
        <div className="wrap">
          <h2>How a payment moves</h2>
          <p className="lead">The lifecycle every proposal follows. Requirements are fixed at step one and limits are re-checked at step four.</p>
          <div className="steps4">
            <div><div className="n">1</div><h4>Proposed and classified</h4><p>The vault reads amount, exposure, recipient trust, today's outflow and the security mode, and pins the tier and its requirements.</p></div>
            <div><div className="n">2</div><h4>Reviewed in plain language</h4><p>Approvers see the economic effect, the treasury impact and why the tier was assigned before their wallet opens.</p></div>
            <div><div className="n">3</div><h4>Confirmed, and maybe vetoed</h4><p>Approvals are recounted against live membership. Guardians can veto critical, probationary or security-reducing proposals at any time.</p></div>
            <div><div className="n">4</div><h4>Executed only if still safe</h4><p>Caps, exposure, recipient state and the loss envelope are checked again at execution. Over the envelope, the vault freezes instead of paying.</p></div>
          </div>
        </div>
      </section>

      <section className="white" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Frequently Asked Questions</h2>
          <div className="faq" style={{ marginTop: 48 }}>
            {[
              ["What is Skur?", "A self-custodial treasury vault whose security requirements change with transaction risk. It combines multisignature authorization with deterministic, onchain risk controls that govern how company assets may move."],
              ["Is this a multisig?", "It contains one, and adds what a plain multisig lacks: per-transaction and cumulative limits, recipient probation, delays and guardian veto for risky transactions, security modes, and a firewall around policy changes."],
              ["Does Skur ever hold my funds or keys?", "No. The vault contract holds the assets, your wallets hold the keys, and no Skur server sits in the execution path. If the website disappears, the vault stays reachable through the verified contracts."],
              ["What happens if a signer is compromised?", "One key cannot reach any tier's threshold alone unless you configured it that way, and even then it is bounded by the routine cap, the daily cap and the loss envelope. Enough keys together still face delays, guardian veto and a circuit breaker."],
              ["What can a guardian do?", "Freeze the vault, veto risky or security-reducing proposals, confirm critical transfers and propose a delayed, owner-cancellable recovery. Guardians hold no treasury role and have no path to move funds."],
              ["Which network is supported?", "Skur V1 runs on the Ark Constellation devnet (chain 9000). Every endpoint lives in one config module so testnet and mainnet are a config change."],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}<span className="plus">+</span></summary>
                <div className="ans">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="grid-bg" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#e6e6e6 1px, transparent 1px), linear-gradient(90deg, #e6e6e6 1px, transparent 1px)", backgroundSize: "131px 131px" }} />
        {[[0, 0], [1310, 0], [520, 260], [780, 0], [130, 390]].map(([x, y], i) => <span key={i} className="cell" style={{ position: "absolute", width: 130, height: 130, left: x, top: y, background: "linear-gradient(180deg, rgba(18,255,128,0) 0%, rgba(18,255,128,0.5) 100%)" }} />)}
        <div className="wrap" style={{ position: "relative" }}>
          <h2>Put a firewall in front of<br /><span>your treasury</span></h2>
          <p className="sub">Secure, self-custodial and readable by the people who sign</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a className="btn btn-white" style={{ border: "1px solid #dcdee0" }} href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Read docs</a>
            <button className="btn btn-primary" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="wrap">
          <div className="cols">
            <div><a className="logo" href="#/" style={{ fontWeight: 800, fontSize: 20 }}>Skur</a></div>
            <div><h5>Product</h5><ul><li><a href="#product">Risk-tiered vault</a></li><li><a href="#security">Guardians</a></li><li><a href="#product">Policy simulator</a></li><li><a href="https://github.com/Emmyhack/skur/tree/main/contracts" target="_blank" rel="noreferrer">Contracts</a></li></ul></div>
            <div><h5>Solutions</h5><ul><li><a href="#solutions">Finance teams</a></li><li><a href="#solutions">Guardians</a></li><li><a href="#solutions">DAOs & funds</a></li></ul></div>
            <div><h5>Company</h5><ul><li><a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub</a></li><li><a href="https://github.com/Emmyhack/skur/blob/main/docs/DECISIONS.md" target="_blank" rel="noreferrer">Decisions</a></li></ul></div>
            <div><h5>Resources</h5><ul><li><a href="#faq">FAQs</a></li><li><a href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Security model</a></li><li><a href="https://explorer.34.60.137.196.sslip.io" target="_blank" rel="noreferrer">Explorer</a></li><li><a href="https://faucet.34.60.137.196.sslip.io/" target="_blank" rel="noreferrer">Faucet</a></li></ul></div>
            <div><h5>Social</h5><ul><li><a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub</a></li></ul></div>
          </div>
          <div className="legal"><span>Skur V1 · Ark Constellation devnet</span><span>MIT licensed. Not a guarantee against loss; read the security model.</span></div>
          <div className="giant">Skur</div>
        </div>
      </footer>
    </div>
  );
}
