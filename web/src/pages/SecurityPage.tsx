import { MarketingShell, SubHero } from "../components/MarketingShell";
import { Reveal } from "../components/Reveal";
import { IconCheck } from "../components/icons";
import { DEPLOYMENTS } from "../config/chain";

const INVARIANTS = [
  ["No proposal executes before every active condition is met", "execution ordering · timelock · live recount"],
  ["A guardian cannot move treasury assets through guardian authority alone", "role exclusivity · no withdrawal path"],
  ["Lockdown blocks ordinary outgoing execution", "mode gate at execution"],
  ["Security-reducing policy changes never take effect immediately", "policyReduces · timelock · veto"],
  ["Cumulative outflow accounting cannot be bypassed by splitting", "24-hour bucket · loss envelope"],
  ["A proposal cannot execute twice", "status written before any external call"],
  ["Removed signers cannot approve new actions", "approvals recounted against live roles"],
  ["Approvals cannot be duplicated or replayed", "one approval per signer per proposal"],
  ["New recipients cannot skip their activation delay", "executable time ≥ activation · re-checked"],
  ["Recovery cannot quietly weaken the policy", "same roles · policy untouched · Elevated after"],
  ["Native and ERC-20 accounting reconciles", "SafeERC20 · totalOutflow matches balances"],
  ["External calls cannot re-enter an unsafe state", "nonReentrant · effects before interactions"],
];

export function SecurityPage({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="security" onLaunch={onLaunch}>
      <SubHero eyebrow="SECURITY" title={<>Built for the day<br />a key is stolen</>} sub="A stolen key, a compromised laptop or a rogue signer should be a bad day, not the end of the treasury. This page is what holds, and what has not been proven yet." onLaunch={onLaunch}>
        <a className="btn btn-white btn-lg" href={`https://explorer.34.60.137.196.sslip.io/address/${DEPLOYMENTS.vaultImplementation}`} target="_blank" rel="noreferrer">Verified source</a>
      </SubHero>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>What we claim, and what we do not</h2>
            <p className="lead">Skur does not make signer compromise harmless. It adds independent, programmable controls that limit or delay the damage when authorised credentials are misused.</p>
          </Reveal>
          <Reveal stagger className="steps4">
            <div><div className="n">1</div><h4>One signer compromised</h4><p>Cannot reach any tier's threshold alone unless you set that tier to one, and even then is bounded by the routine cap, the daily cap and the loss envelope.</p></div>
            <div><div className="n">2</div><h4>Enough signers compromised</h4><p>High and critical delays give guardians a veto window, critical transfers need a guardian, and the envelope freezes the vault on the first over-limit attempt.</p></div>
            <div><div className="n">3</div><h4>An admin weakens the policy</h4><p>Loosening waits for the policy-change delay, can be vetoed by any guardian, and cannot be proposed at all while the vault is in Lockdown.</p></div>
            <div><div className="n">4</div><h4>A guardian is compromised</h4><p>There is no withdrawal path. Recovery is delayed and any owner can cancel it. A guardian can only freeze or veto.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="dark">
        <div className="wrap">
          <Reveal>
            <h2>Twelve invariants, each with a test</h2>
            <p className="lead">Every control is enforced by the contract and proven by a unit, fuzz or stateful invariant test. The mapping is public in the security model.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            {INVARIANTS.map(([t, how], i) => (
              <div key={t}>
                <div className="ico" style={{ fontWeight: 800 }}>{i + 1}</div>
                <h4 style={{ fontSize: 16 }}>{t}</h4>
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>{how}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="light">
        <div className="wrap">
          <Reveal>
            <h2>Verification, honestly stated</h2>
            <p className="lead">What has been done, and what has not.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconCheck /></div><h4>95 contract tests</h4><p>A unit test per control, fuzzed monotonicity properties, and a stateful handler that drives random actors against the vault.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Static analysis</h4><p>Slither reports nothing above informational. The linter is clean. Every narrowing cast is bounded and documented in place.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Verified and reproducible</h4><p>Sources are verified on Blockscout, and the repository builds to byte-identical runtime bytecode.</p></div>
            <div><div className="ico" style={{ background: "#adb5bd" }}>–</div><h4>Independent audit</h4><p>Not yet. Do not put real value behind Skur until one has been completed.</p></div>
            <div><div className="ico" style={{ background: "#adb5bd" }}>–</div><h4>Private pilot</h4><p>Not yet. The devnet deployment exists for evaluation.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Known limitations, listed</h4><p>Anchored 24-hour buckets, per-asset exposure without an oracle, a breaker that latches rather than refunds, single-guardian vaults. All in the model.</p></div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
