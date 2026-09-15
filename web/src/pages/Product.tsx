import { MarketingShell, SubHero } from "../components/MarketingShell";
import { AppMockup } from "../components/Mockup";
import { Reveal } from "../components/Reveal";
import { IconBank, IconBook, IconClock, IconGuard, IconLab, IconLayers, IconShield, IconTrend, IconTx } from "../components/icons";

/** safe.global/wallet equivalent: what the product does, feature by feature. */
export function Product({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="product" onLaunch={onLaunch}>
      <SubHero eyebrow="PRODUCT" title={<>Multisig approvals, then<br />a firewall</>} sub="Skur keeps the N-of-M you know and adds the controls that decide whether a valid approval should be allowed to move money right now." onLaunch={onLaunch}>
        <a className="btn btn-white btn-lg" href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Read the model</a>
      </SubHero>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>Beyond signature counts. Always in your control.</h2>
            <p className="lead">Every control ships as contract code that anyone can read on the explorer. The interface only shows what the vault already enforces.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconTrend /></div><h4>Risk-tiered approvals</h4><p>Amount, share of holdings, recipient trust, today's outflow and security posture set the tier; the tier sets the approvals, guardian sign-off and delay.</p></div>
            <div><div className="ico"><IconBook /></div><h4>Recipient trust</h4><p>Unknown addresses wait an activation delay and are escalated. Owners can verify, trust, restrict or block a recipient through governance.</p></div>
            <div><div className="ico"><IconLayers /></div><h4>Velocity limits</h4><p>Per-transaction and 24-hour caps counted cumulatively, so splitting a payment changes nothing.</p></div>
            <div><div className="ico"><IconShield /></div><h4>Circuit breaker</h4><p>A loss envelope per window. The transfer that would exceed it is not paid; the vault enters Lockdown instead.</p></div>
            <div><div className="ico"><IconGuard /></div><h4>Guardians</h4><p>An independent role that can freeze, veto, confirm critical transfers and recover signers, and can never withdraw.</p></div>
            <div><div className="ico"><IconClock /></div><h4>Policy-change firewall</h4><p>Loosening any control waits for a delay, can be vetoed, and cannot even be proposed during Lockdown.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="dark">
        <div className="wrap">
          <Reveal>
            <h2>Know exactly what you're signing</h2>
            <p className="lead">Before the wallet opens, the vault itself explains the payment: amount, treasury impact, recipient state, tier, the reasons for the tier and the exact requirement.</p>
          </Reveal>
          <Reveal className="shield">
            <div>
              <h2 style={{ fontSize: 32 }}>Human-readable review</h2>
              <p>The preview is read from the contract's own classification, so the interface can never promise something the vault will refuse.</p>
              <ul>
                <li>Economic effect and remaining balance</li>
                <li>Why this tier was assigned</li>
                <li>Approvals, guardian sign-off and delay</li>
              </ul>
            </div>
            <div className="tilt"><AppMockup /></div>
          </Reveal>
        </div>
      </section>

      <section className="light" id="simulator">
        <div className="wrap">
          <Reveal>
            <h2>Test the policy before it is live</h2>
            <p className="lead">The simulator runs the blueprint's attack scenarios against a policy using the same deterministic rules the contract applies.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconLab /></div><h4>Attack scenarios</h4><p>One compromised signer, three compromised signers, a split drain, a policy weakened before withdrawal, a compromised guardian.</p></div>
            <div><div className="ico"><IconBank /></div><h4>Maximum possible loss</h4><p>One conservative number per asset: what could leave with no delay, what could leave in a day, and how long the largest transfers wait.</p></div>
            <div><div className="ico"><IconTx /></div><h4>Posture indicator</h4><p>Confirmed controls and obvious weaknesses, stated plainly, without claiming to measure absolute security.</p></div>
          </Reveal>
          <Reveal className="mock" >
            <div style={{ maxWidth: 900, margin: "48px auto 0", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 60px rgba(33,37,41,0.18)" }}><AppMockup variant="policy" /></div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
