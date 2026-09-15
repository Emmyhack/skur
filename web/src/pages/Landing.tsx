import { useEffect } from "react";
import { MarketingShell } from "../components/MarketingShell";
import { AppMockup } from "../components/Mockup";
import { ScoreTicker } from "../components/Ticker";
import { Reveal } from "../components/Reveal";
import { IconArrowRight, IconCheck, IconChevronRight } from "../components/icons";
import { useCountUp } from "../lib/motion";

function Stat({ n, label }: { n: number; label: string }) {
  const { ref, value } = useCountUp(n, 1400);
  return (
    <div>
      <span className="v" ref={ref} style={{ display: "block" }}>{value}</span>
      <div className="l">{label}</div>
    </div>
  );
}

const FAQ: Array<[string, string]> = [
  ["What is Skur?", "A self-custodial treasury vault whose security requirements rise and fall with the risk of each transaction. It keeps multisignature approval and adds onchain rules about how much can move, where it can go and how long risky payments wait."],
  ["How is that different from a multisig?", "A multisig asks one question: did enough people sign? Skur asks a second one: should this transaction be allowed right now? Amount tiers, recipient trust, daily caps, a loss envelope, guardian veto and a firewall around policy changes all sit between a valid approval and the money."],
  ["Does Skur ever hold my funds or keys?", "No. The vault contract holds the assets and your wallets hold the keys. No Skur server is in the execution path. If this website disappears, the vault and its policy are still there and still reachable through the verified contracts."],
  ["What happens if one of our signers is compromised?", "Alone, a stolen key cannot reach any tier's threshold unless you set that tier to one. Even then it is bounded by the routine cap, the daily cap and the loss envelope. If several keys are stolen, the larger payments still wait out a delay any guardian can use to veto, and the envelope freezes the vault on the first over-limit attempt."],
  ["What can a guardian do?", "Freeze the vault, veto critical or security-reducing proposals, confirm the largest transfers and propose replacing a lost signer after a delay. Guardians hold no treasury role, so a stolen guardian key cannot move a single token."],
  ["Which network does it run on?", "Skur V1 runs on the Ark Constellation devnet, chain 9000. Every endpoint lives in one configuration module, so testnet and mainnet are a configuration change rather than a rewrite."],
  ["Has it been audited?", "Not yet. The contracts are verified on the explorer, covered by 95 tests including stateful invariant tests, and clean under static analysis. Do not put real value behind Skur before an independent audit."],
];

const HERO_CELLS: Array<[number, number]> = [[0, 130], [130, 260], [1180, 0], [1310, 0], [1310, 130], [910, 390], [1050, 260], [520, 0]];

/** Public landing page. */
export function Landing({ onLaunch }: { onLaunch: () => void }) {
  useEffect(() => {
    const m = window.location.hash.match(/#\/#(.+)$/);
    if (m) setTimeout(() => document.getElementById(m[1])?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);
  const words = "Treasury security that".split(" ");

  return (
    <MarketingShell page="landing" onLaunch={onLaunch}>
      <div className="announce">
        <a href="#/security">Skur V1 is live on the Ark Constellation devnet. Every control runs onchain <span>→</span></a>
      </div>

      <section className="hero">
        <div className="grid-bg" />
        {HERO_CELLS.map(([x, y], i) => <span key={i} className="cell" style={{ left: x, top: y, animationDelay: `${i * 0.55}s`, animationDuration: `${5 + (i % 4)}s` }} />)}
        <div className="wrap">
          <div className="eyebrow"><b>12 invariants</b> enforced by the vault, not by a server</div>
          <h1>
            {words.map((w, i) => (
              <span key={i} className="w" style={{ animation: `rise 0.7s var(--ease) ${0.08 + i * 0.06}s both`, marginRight: "0.22em" }}>{w}</span>
            ))}
            <span className="mark-hl">
              {["assumes", "compromise"].map((w, i) => (
                <span key={w} className="w" style={{ animation: `rise 0.7s var(--ease) ${0.08 + (words.length + i) * 0.06}s both`, marginRight: i === 0 ? "0.22em" : 0 }}>{w}</span>
              ))}
            </span>
          </h1>
          <p className="sub">An approval proves someone was authorised. Skur decides whether the payment is safe: how much can move, where it can go, and how long the risky ones wait, even when your signers are compromised.</p>
          <div className="cta-row">
            <button className="btn btn-accent btn-lg" onClick={onLaunch}>Launch app <IconChevronRight width={16} height={16} /></button>
            <a className="btn btn-white btn-lg" href="#/product">See how it works</a>
          </div>
          <div className="hero-meta"><span>Self-custodial</span><span>Ark Constellation devnet · 9000</span><span>Verified source</span></div>
          <div className="mockwrap">
            <div className="mock"><AppMockup /></div>
            <div className="float"><ScoreTicker /></div>
          </div>
        </div>
      </section>
      <div className="tape" />

      <section className="light" style={{ paddingTop: 72 }}>
        <div className="wrap center" style={{ textAlign: "center" }}>
          <Reveal>
            <h2 style={{ fontSize: 30 }}>Made for teams that hold real money onchain</h2>
            <p className="lead" style={{ marginBottom: 32 }}>Startups, DAOs, funds, nonprofits and family offices that need more than a signature count between a stolen key and the treasury.</p>
          </Reveal>
          <div className="marquee">
            <div className="track">
              {[...Array(2)].flatMap((_, k) => ["Startups", "Protocols & DAOs", "Venture funds", "Nonprofits", "Family offices", "Finance teams", "Onchain service providers", "Grant programmes"].map((t) => (
                <span key={`${k}-${t}`} className="chip-l">{t}</span>
              )))}
            </div>
          </div>
        </div>
      </section>

      <section className="dark" id="product">
        <div className="wrap">
          <Reveal>
            <div className="secno">01 / Controls</div>
            <h2>Your treasury, under control</h2>
            <p className="lead">Every rule below is contract code, not a setting on our server. If Skur disappeared tomorrow, your vault and its policy would not.</p>
          </Reveal>
          <Reveal stagger className="bento">
            <div className="bcard big center">
              <h3>Risk-tiered approvals</h3>
              <p>The vault scores every payment from its amount, its share of holdings, who receives it, what already left today and the current security mode. The score sets how many approvals it needs, whether a guardian must sign, and how long it waits.</p>
              <div className="art" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 24, maxWidth: 820, margin: "0 auto" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                  {["1,000 sUSD to a known supplier", "12,000 sUSD to a new address", "60,000 sUSD, 24% of holdings"].map((t) => <span key={t} style={{ background: "#343a40", padding: "10px 16px", borderRadius: 8, fontSize: 14 }}>{t}</span>)}
                </div>
                <div style={{ width: 96, height: 96, borderRadius: "50%", border: "6px solid #343a40", boxShadow: "0 0 0 2px #ffd000 inset", display: "grid", placeItems: "center", background: "#212529", fontWeight: 800, color: "#fff", animation: "float 4s ease-in-out infinite" }}>S</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ background: "#ffd000", color: "#212529", padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>Low · 1 approval · executes now</span>
                  <span style={{ background: "#4d3a05", color: "#fff3cd", padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>High · 2 approvals · waits 1 day</span>
                  <span style={{ background: "#4a1c22", color: "#f8d7da", padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>Critical · 2 + a guardian · 1 day · vetoable</span>
                </div>
              </div>
            </div>
            <div className="bcard">
              <h3>Recipient trust</h3>
              <p>Recipients are security objects, not strings. A never-seen address serves an activation delay and is treated as higher risk until it has. Owners can verify, trust, restrict or block anyone.</p>
              <div className="art" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["New", "activates in 23h", "#1b3a5c", "#cfe2ff", "0x7c4f…41e2"], ["Verified", "normal policy", "#1b4332", "#d1e7dd", "0x3a91…c0de"], ["Restricted", "always critical", "#4d3a05", "#fff3cd", "0xe2b7…9f10"], ["Blocked", "refused", "#4a1c22", "#f8d7da", "0x0d55…77aa"]].map(([s, d, bg, fg, addr]) => (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", background: "#212529", padding: "12px 14px", borderRadius: 6 }}><span className="mono" style={{ fontSize: 13 }}>{addr}</span><span style={{ background: bg, color: fg, padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{s} · {d}</span></div>
                ))}
              </div>
            </div>
            <div className="bcard">
              <h3>Velocity limits and a circuit breaker</h3>
              <p>Outflow is counted cumulatively, so a drain split into twenty small transfers hits the same wall as one large one. Cross the loss envelope and the vault freezes instead of paying.</p>
              <div className="art">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#adb5bd" }}><span>Left the vault today</span><span>98,000 of 100,000 sUSD</span></div>
                <div style={{ height: 10, background: "#343a40", borderRadius: 5, margin: "8px 0 16px", overflow: "hidden" }}><div style={{ width: "98%", height: "100%", background: "#ffcd39", borderRadius: 5, transformOrigin: "left", animation: "grow 1.4s var(--ease)" }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#adb5bd" }}><span>Loss envelope, 24 hours</span><span>25,000 sUSD, then Lockdown</span></div>
                <div style={{ height: 10, background: "#343a40", borderRadius: 5, margin: "8px 0", overflow: "hidden" }}><div style={{ width: "40%", height: "100%", background: "#ffd000", borderRadius: 5, transformOrigin: "left", animation: "grow 1.8s var(--ease)" }} /></div>
              </div>
            </div>
            <div className="bcard">
              <h3>Independent guardians</h3>
              <p>A second control plane that can freeze, veto, confirm and recover, and that can never withdraw. Stealing one role is not enough.</p>
              <div className="art" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#212529", borderRadius: 8, padding: 14 }}><div style={{ color: "#adb5bd", fontSize: 12, marginBottom: 6 }}>Treasury signers</div>Propose · Approve · Execute</div>
                <div style={{ background: "#212529", borderRadius: 8, padding: 14, border: "1px solid #ffd000" }}><div style={{ color: "#ffd000", fontSize: 12, marginBottom: 6 }}>Guardians</div>Freeze · Veto · Recover<br /><span style={{ color: "#adb5bd", fontSize: 12 }}>never withdraw</span></div>
              </div>
            </div>
            <div className="bcard" id="simulator">
              <h3>Policy simulator</h3>
              <p>Run your policy against the attacks that actually happen, before you activate it. Verdicts come from the same rules the contract enforces, so the simulator cannot promise what the vault will refuse.</p>
              <div className="art"><AppMockup variant="policy" /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="dark" id="security" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="secno">02 / Guarantees</div>
            <h2>Security a finance team can read</h2>
            <p className="lead">Every control fits in one sentence, and every one is checked at execution, not only at approval.</p>
          </Reveal>
          <Reveal stagger className="dashed">
            <div><h4>No single point of failure</h4><p>Thresholds scale with risk, and guardians hold no treasury role. One stolen key, or one compromised role, cannot empty the vault.</p></div>
            <div><h4>Enforced onchain</h4><p>Limits, delays, vetoes and modes live in the vault contract. Requirements are pinned when a proposal is created and checked again when it executes.</p></div>
            <div><h4>Open source and verified</h4><p>Source is verified on the Ark explorer and the repository builds to byte-identical bytecode. Twelve invariants are proven with fuzz and stateful tests.</p></div>
            <div><h4>Recovery without a backdoor</h4><p>Guardians can replace a lost signer after a delay any owner can cancel. Recovery never touches the policy and leaves the vault in Elevated mode.</p></div>
          </Reveal>
          <Reveal className="badges" as="div">
            <span className="lbl">Verified with</span>
            <span>Foundry fuzz and invariant tests</span>
            <span>Slither</span>
            <span>Blockscout source verification</span>
            <span>OpenZeppelin 5</span>
          </Reveal>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="shield">
            <div>
              <div className="secno">03 / Policy firewall</div>
              <h2>A firewall around the policy itself</h2>
              <p>Changing the rules is as dangerous as moving the money. An attacker who can lower a threshold never needs to touch the withdrawal path.</p>
              <ul>
                <li><IconCheck /> Loosening any control waits; it never applies instantly</li>
                <li><IconCheck /> Any guardian can veto the change</li>
                <li><IconCheck /> Lockdown refuses it outright</li>
              </ul>
            </div>
            <div className="tilt"><AppMockup variant="queue" /></div>
          </Reveal>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><div className="secno">04 / Compared</div><h2>Not every multisig is the same</h2></Reveal>
          <Reveal className="compare">
            <table>
              <thead>
                <tr><th></th><th className="hl">Skur</th><th>Plain multisig</th><th>Custodial policy engine</th></tr>
              </thead>
              <tbody>
                <tr><td>Authorization</td><td className="hl">Threshold follows transaction risk</td><td>Fixed N-of-M</td><td>Configurable, off-chain</td></tr>
                <tr><td>Enough signers compromised</td><td className="hl">Caps, delays, guardian veto and a circuit breaker</td><td>Funds gone</td><td>Depends on the provider</td></tr>
                <tr><td>Policy tampering</td><td className="hl">Delayed, vetoable, blocked in Lockdown</td><td>Immediate</td><td>Provider-controlled</td></tr>
                <tr><td>Custody</td><td className="hl">Self-custodial, no server in the path</td><td>Self-custodial</td><td>Provider holds keys or approvals</td></tr>
                <tr><td>Transparency</td><td className="hl">Every rule and every version onchain</td><td>Onchain</td><td>Limited</td></tr>
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <Reveal className="wrap quote">
          <blockquote>"Control not only who can move treasury funds, but how much can move, where it can go, and what happens when risk changes."</blockquote>
          <cite>The Skur thesis</cite>
          <div className="stats">
            <Stat n={12} label="Invariants, each with a test" />
            <Stat n={95} label="Contract tests passing" />
            <Stat n={0} label="Servers between you and your vault" />
          </div>
        </Reveal>
      </section>

      <section className="light" id="solutions">
        <div className="wrap">
          <Reveal>
            <div className="secno">05 / Who it is for</div>
            <h2>Two roles. Two kinds of power.</h2>
            <p className="lead">Finance teams move the money. Guardians hold the brake. Neither can do the other's job.</p>
          </Reveal>
          <Reveal stagger className="audiences">
            <div className="acard">
              <h3>For finance teams</h3>
              <p>Tiered approvals, trusted recipients, daily caps and a plain-language review before every signature.</p>
              <a href="#/solutions">How teams use Skur <IconArrowRight width={16} height={16} /></a>
              <div className="art"><AppMockup /></div>
            </div>
            <div className="acard">
              <h3>For guardians</h3>
              <p>Freeze the vault, veto the risky and the security-reducing, confirm the largest transfers, recover a lost signer. Never touch a coin.</p>
              <a href="#/solutions#guardians">What a guardian can do <IconArrowRight width={16} height={16} /></a>
              <div className="art"><AppMockup variant="queue" /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <div className="secno">06 / Lifecycle</div>
            <h2>How a payment moves</h2>
            <p className="lead">Requirements are fixed at step one. Limits are checked again at step four.</p>
          </Reveal>
          <Reveal stagger className="steps4">
            <div><div className="n">1</div><h4>Proposed and scored</h4><p>The vault reads the amount, its share of holdings, the recipient's trust, today's outflow and the security mode, then pins the tier and its requirements to the proposal.</p></div>
            <div><div className="n">2</div><h4>Reviewed in plain language</h4><p>Approvers see what leaves, what remains, who receives it and why the tier was assigned, before their wallet opens.</p></div>
            <div><div className="n">3</div><h4>Confirmed, or vetoed</h4><p>Approvals are recounted against live membership. Any guardian can veto a critical, probationary or security-reducing proposal at any time.</p></div>
            <div><div className="n">4</div><h4>Executed only if still safe</h4><p>Caps, exposure, recipient state and the loss envelope are checked again at execution. Over the envelope, the vault freezes instead of paying.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="white" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><div className="secno">07 / Questions</div><h2>Questions, answered plainly</h2></Reveal>
          <Reveal className="faq">
            <div style={{ marginTop: 48 }}>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}<span className="plus">+</span></summary>
                  <div className="ans">{a}</div>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
