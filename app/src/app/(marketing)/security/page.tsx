'use client';

import { MarketingShell, SubHero } from '@/marketing/Shell';
import { Reveal } from '@/marketing/Reveal';
import { IconCheck } from '@/marketing/icons';
import { NETWORK, PACKAGE_ID, CONFIGURED } from '@/config';

/** The fifteen invariants, each with the control that enforces it. */
const INVARIANTS: [string, string][] = [
  ['Nothing executes before every active condition is met', 'ordered assertions in execute_transfer'],
  ['A guardian cannot move treasury assets through guardian authority', 'types::roles_valid · role gates'],
  ['Lockdown stops outgoing execution and new payments', 'assert_not_lockdown'],
  ['A security-reducing change never takes effect immediately', 'policy::reductions · delay · veto'],
  ['Cumulative outflow cannot be bypassed by splitting', 'day bucket · loss envelope'],
  ['A proposal cannot execute twice', 'status written before the coin moves'],
  ['A removed signer’s approval stops counting', 'count_with_role against the live roster'],
  ['An approval cannot be duplicated or replayed', 'one entry per address in a VecSet'],
  ['A new recipient cannot skip its activation delay', 'executable_at = max(delay, activates_at)'],
  ['Recovery cannot quietly weaken the vault', 'roles copied · policy untouched · Elevated after'],
  ['Balance accounting reconciles', 'one Balance<T> per type · split is the only exit'],
  ['The roster always satisfies the policy', 'assert_counts_valid after every change'],
  ['The breaker’s latch survives the attempt', 'execute_transfer returns without aborting'],
  ['Leaving a raised posture is never unilateral', 'owners + guardians + delay'],
  ['An automation key cannot authorize itself', 'PROPOSER satisfies only can_propose'],
];

export default function SecurityPage() {
  return (
    <MarketingShell page="security">
      <SubHero
        eyebrow="SECURITY"
        title={
          <>
            Built for the day
            <br />
            a key is stolen
          </>
        }
        sub="A stolen key, a compromised laptop or a rogue signer should be a bad day, not the end of the treasury. This page is what holds, and what has not been proven yet."
      >
        {CONFIGURED ? (
          <a
            className="btn btn-white btn-lg"
            href={`https://suiscan.xyz/${NETWORK}/object/${PACKAGE_ID}`}
            target="_blank"
            rel="noreferrer"
          >
            The published package
          </a>
        ) : null}
      </SubHero>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>What we claim, and what we do not</h2>
            <p className="lead">
              Skur does not make signer compromise harmless. It adds independent, programmable
              controls that limit or delay the damage when authorized credentials are misused.
            </p>
          </Reveal>
          <Reveal stagger className="steps4">
            <div>
              <div className="n">1</div>
              <h4>One signer compromised</h4>
              <p>
                Cannot reach any tier’s threshold alone unless you set that tier to one — and even
                then it is bounded by the routine maximum, the per-payment cap, the day’s remaining
                allowance and the loss envelope.
              </p>
            </div>
            <div>
              <div className="n">2</div>
              <h4>Enough signers compromised</h4>
              <p>
                The high and critical delays are a guardian’s veto window, critical payments need a
                guardian, and the envelope freezes the vault on the first attempt that would cross
                it.
              </p>
            </div>
            <div>
              <div className="n">3</div>
              <h4>An owner quorum weakens the policy</h4>
              <p>
                Loosening waits out the policy-change delay, can be vetoed by any guardian, and
                cannot be proposed at all while the vault is in Lockdown.
              </p>
            </div>
            <div>
              <div className="n">4</div>
              <h4>A guardian is compromised</h4>
              <p>
                There is no withdrawal path. A recovery is delayed and any owner can cancel it. A
                guardian can only freeze, veto and block.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="dark">
        <div className="wrap">
          <Reveal>
            <h2>Fifteen invariants, each with a test</h2>
            <p className="lead">
              Every control is enforced by the Move code and proven by a test named after the attack
              it defends against. The mapping is public in the security model.
            </p>
          </Reveal>
          <Reveal stagger className="feat6">
            {INVARIANTS.map(([t, how], i) => (
              <div key={t}>
                <div className="ico" style={{ fontWeight: 800 }}>
                  {i + 1}
                </div>
                <h4 style={{ fontSize: 16 }}>{t}</h4>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{how}</p>
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
            <div>
              <div className="ico"><IconCheck /></div>
              <h4>Two Move test suites</h4>
              <p>
                One pins the risk classifier and the policy rules as vectors; one drives the vault
                end to end, with a test per attack rather than per function.
              </p>
            </div>
            <div>
              <div className="ico"><IconCheck /></div>
              <h4>The engines agree with the chain</h4>
              <p>
                The TypeScript risk engine is pinned against the same vectors as the Move suite, so
                a preview and an execution cannot disagree about a tier.
              </p>
            </div>
            <div>
              <div className="ico"><IconCheck /></div>
              <h4>Reproducible builds</h4>
              <p>
                The toolchain version is pinned in CI, because the Move compiler and the bundled
                framework move together and a job that silently upgrades either cannot reproduce a
                failure.
              </p>
            </div>
            <div>
              <div className="ico" style={{ background: '#adb5bd' }}>–</div>
              <h4>Independent audit</h4>
              <p>Not yet. Do not put real value behind Skur until one has been completed.</p>
            </div>
            <div>
              <div className="ico" style={{ background: '#adb5bd' }}>–</div>
              <h4>Mainnet deployment</h4>
              <p>Not yet. Testnet exists for evaluation.</p>
            </div>
            <div>
              <div className="ico"><IconCheck /></div>
              <h4>Known limitations, listed</h4>
              <p>
                Anchored windows, per-asset exposure with no oracle, a breaker that latches rather
                than refunds, single-guardian vaults, and a throughput ceiling per shared object.
                All of it is in the model.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
