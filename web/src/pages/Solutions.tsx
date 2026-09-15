import { MarketingShell, SubHero } from "../components/MarketingShell";
import { AppMockup } from "../components/Mockup";
import { Reveal } from "../components/Reveal";
import { IconArrowRight, IconBank, IconClock, IconGuard, IconLayers, IconShield, IconUsers } from "../components/icons";
import { TEMPLATES } from "../lib/templates";
import { fmtDuration } from "../lib/format";

/** safe.global/teams + /users equivalent: who Skur is for and which template fits. */
export function Solutions({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="solutions" onLaunch={onLaunch}>
      <SubHero eyebrow="SOLUTIONS" title={<>The standard for<br />onchain treasury control</>} sub="Manage a company treasury with approvals that scale with risk, recipients that earn trust, and guardians who can stop a bad day without ever being able to cause one." onLaunch={onLaunch} />

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>Three steps to a protected treasury</h2>
            <p className="lead">No policy is designed from first principles. Pick a template, name the people, sign once.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconUsers /></div><h4>Add members and guardians</h4><p>Owners run governance, approvers confirm payments, executors execute. Guardians hold the brake and nothing else.</p></div>
            <div><div className="ico"><IconLayers /></div><h4>Pick a policy template</h4><p>Six profiles from Startup to Family Office set the tiers, delays, caps and envelope. Every number can be tuned later through governance.</p></div>
            <div><div className="ico"><IconShield /></div><h4>Operate with a firewall</h4><p>Every payment is classified and reviewed in plain language; every loosening of the policy is delayed and vetoable.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="light" id="dao">
        <div className="wrap">
          <Reveal>
            <h2>Built for every kind of team</h2>
            <p className="lead">The same vault, six starting points.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            {TEMPLATES.map((t) => (
              <div key={t.id}>
                <div className="ico"><IconBank /></div>
                <h4>{t.name}</h4>
                <p>{t.tagline}</p>
                <p style={{ marginTop: 12, fontSize: 14 }}>
                  Critical transfers wait {fmtDuration(t.policy.delayCritical)} · new recipients wait {fmtDuration(t.policy.recipientActivationDelay)} · loss envelope {t.policy.envelopeBps / 100}% per day
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="dark" id="guardians">
        <div className="wrap">
          <Reveal>
            <h2>For guardians</h2>
            <p className="lead">A cold key, a board member, a security firm: anyone who should be able to stop money but never move it.</p>
          </Reveal>
          <Reveal className="shield">
            <div>
              <h2 style={{ fontSize: 32 }}>Hold the brake, not the wheel</h2>
              <p>Guardians are enforced by the contract to have no treasury role. They are the second control plane an attacker has to breach.</p>
              <ul>
                <li><IconGuard /> Freeze the vault instantly</li>
                <li><IconShield /> Veto critical and security-reducing proposals</li>
                <li><IconClock /> Recover a lost signer after a delay</li>
              </ul>
            </div>
            <div className="tilt"><AppMockup variant="queue" /></div>
          </Reveal>
        </div>
      </section>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>No custody, no AUM fees, no lock-in</h2>
            <p className="lead">Skur never holds a key and never takes a percentage. The vault is an immutable contract you can reach with any compatible interface.</p>
          </Reveal>
          <Reveal stagger className="audiences" >
            <div className="acard">
              <h3>Self-custodial by construction</h3>
              <p>The vault contract holds the assets. Your wallets hold the keys. The factory has no authority over vaults it creates.</p>
              <a href="#/security">Security model <IconArrowRight width={16} height={16} /></a>
            </div>
            <div className="acard">
              <h3>Reachable without Skur</h3>
              <p>Contracts are verified on the Ark explorer. Every endpoint lives in one config file. If this site disappears, your vault does not.</p>
              <a href="https://explorer.34.60.137.196.sslip.io" target="_blank" rel="noreferrer">Open the explorer <IconArrowRight width={16} height={16} /></a>
              <div className="art"><AppMockup /></div>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
