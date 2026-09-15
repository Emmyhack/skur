import { MarketingShell, SubHero } from "../components/MarketingShell";
import { Reveal } from "../components/Reveal";
import { IconCheck } from "../components/icons";
import { DEPLOYMENTS } from "../config/chain";

const INVARIANTS = [
  ["No proposal executes before every active condition is satisfied", "execute ordering · timelock · live recount"],
  ["A guardian cannot move treasury assets through guardian authority alone", "role exclusivity · no withdrawal path"],
  ["Lockdown prevents ordinary outgoing execution", "mode gate at execution"],
  ["Security-reducing policy changes never take immediate effect", "policyReduces · timelock · veto"],
  ["Cumulative outflow accounting cannot be bypassed by splitting", "24h bucket · envelope"],
  ["A proposal cannot be executed twice", "status set before interaction"],
  ["Removed signers cannot approve new actions", "approvals recounted against live roles"],
  ["Approval counting cannot be duplicated or replayed", "one approval per signer per proposal"],
  ["New recipients cannot bypass their activation delay", "executableAfter ≥ activatesAt · re-checked"],
  ["Recovery cannot silently weaken the vault's policy", "same roles · policy untouched · Elevated"],
  ["Native and ERC-20 accounting is correct", "SafeERC20 · totalOutflow reconciles"],
  ["External calls cannot re-enter an unsafe state", "nonReentrant · effects before interactions"],
];

/** safe.global/security equivalent: the threat model, the invariants, the verification. */
export function SecurityPage({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="security" onLaunch={onLaunch}>
      <SubHero eyebrow="SECURITY" title={<>Secure by assumption<br />of compromise</>} sub="Skur is designed so that a stolen key, a compromised device or a rogue signer is a bad day, not the end of the treasury." onLaunch={onLaunch}>
        <a className="btn btn-white btn-lg" href={`https://explorer.34.60.137.196.sslip.io/address/${DEPLOYMENTS.vaultImplementation}`} target="_blank" rel="noreferrer">Verified source</a>
      </SubHero>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>What we claim, and what we don't</h2>
            <p className="lead">Skur does not make signer compromise harmless. It adds independent, programmable controls that can limit or delay damage even when authorized credentials are compromised.</p>
          </Reveal>
          <Reveal stagger className="steps4">
            <div><div className="n">1</div><h4>One signer compromised</h4><p>Cannot reach any tier's threshold alone unless configured so, and even then is bounded by the routine cap, the daily cap and the loss envelope.</p></div>
            <div><div className="n">2</div><h4>Enough signers compromised</h4><p>High and critical delays give guardians a veto window; critical transfers need a guardian; the envelope trips Lockdown on the first over-limit attempt.</p></div>
            <div><div className="n">3</div><h4>Admin weakens the policy</h4><p>Loosening waits for the policy-change delay, can be vetoed, and is impossible while in Lockdown.</p></div>
            <div><div className="n">4</div><h4>Guardian compromised</h4><p>No withdrawal path exists. Recovery is delayed and owner-cancellable. A guardian can only freeze or veto.</p></div>
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
            <h2>Verification</h2>
            <p className="lead">What has been done, and what has not.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconCheck /></div><h4>95 contract tests</h4><p>Unit tests per control, fuzzed monotonicity properties, and a stateful handler that drives random actors against the vault.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Static analysis</h4><p>Slither reports nothing above informational. The linter is clean. Every cast is bounded and documented.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Verified and reproducible</h4><p>Sources verified on Blockscout; the repository builds to byte-identical runtime bytecode.</p></div>
            <div><div className="ico" style={{ background: "#adb5bd" }}>–</div><h4>Independent audit</h4><p>Not yet done. Do not put real value behind Skur until it is.</p></div>
            <div><div className="ico" style={{ background: "#adb5bd" }}>–</div><h4>Private pilot</h4><p>Not yet run. The devnet deployment is for evaluation.</p></div>
            <div><div className="ico"><IconCheck /></div><h4>Known limitations stated</h4><p>Anchored 24h buckets, per-asset exposure without an oracle, a latching breaker, single-guardian vaults. All listed in the model.</p></div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
