import { MarketingShell, SubHero } from "../components/MarketingShell";
import { AppMockup } from "../components/Mockup";
import { Reveal } from "../components/Reveal";
import { IconBank, IconBook, IconClock, IconGuard, IconLab, IconLayers, IconShield, IconTrend, IconTx } from "../components/icons";

export function Product({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="product" onLaunch={onLaunch}>
      <SubHero eyebrow="PRODUCT" title={<>Multisig approvals,<br />plus a firewall</>} sub="Keep the N-of-M you already trust. Add the controls that decide whether a valid approval should move money right now." onLaunch={onLaunch}>
        <a className="btn btn-white btn-lg" href="#/docs/risk-tiers">Read the security model</a>
      </SubHero>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>Six controls between an approval and the money</h2>
            <p className="lead">Each one is contract code you can read on the explorer. The interface never shows a rule the vault does not enforce.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconTrend /></div><h4>Risk-tiered approvals</h4><p>Amount, share of holdings, recipient trust, today's outflow and the security mode set the tier. The tier sets the approvals, the guardian sign-off and the wait.</p></div>
            <div><div className="ico"><IconBook /></div><h4>Recipient trust</h4><p>A never-seen address waits out an activation delay and is treated as higher risk until then. Owners can verify, trust, restrict or block any recipient through governance.</p></div>
            <div><div className="ico"><IconLayers /></div><h4>Velocity limits</h4><p>Per-transaction and 24-hour caps, counted cumulatively. Splitting a payment into pieces changes nothing.</p></div>
            <div><div className="ico"><IconShield /></div><h4>Circuit breaker</h4><p>A loss envelope per window. The transfer that would cross it is not paid; the vault enters Lockdown instead, and leaving Lockdown takes owners, guardians and time.</p></div>
            <div><div className="ico"><IconGuard /></div><h4>Guardians</h4><p>An independent role that can freeze, veto, confirm critical transfers and recover a lost signer, and that has no path to withdraw.</p></div>
            <div><div className="ico"><IconClock /></div><h4>Policy-change firewall</h4><p>Loosening any control waits for a delay, can be vetoed by a guardian, and cannot even be proposed while the vault is in Lockdown.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="dark">
        <div className="wrap">
          <Reveal>
            <h2>Know exactly what you are signing</h2>
            <p className="lead">Before the wallet opens, the vault itself describes the payment: what leaves, what remains, who receives it, why it was scored the way it was, and what it needs to execute.</p>
          </Reveal>
          <Reveal className="shield">
            <div>
              <h2 style={{ fontSize: 32 }}>A review written by the contract</h2>
              <p>The preview is the vault's own classification, read live. The interface cannot promise something the vault would later refuse.</p>
              <ul>
                <li>Amount, treasury impact and remaining balance</li>
                <li>Every reason the tier was assigned</li>
                <li>Approvals, guardian sign-off and delay, exactly as pinned</li>
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
            <p className="lead">The simulator runs the attacks that actually happen against your policy, using the same deterministic rules the contract applies.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconLab /></div><h4>Attack scenarios</h4><p>One stolen key paying a new address. Three stolen keys taking 40%. A drain split into twenty transfers. A policy weakened before a withdrawal. A stolen guardian key.</p></div>
            <div><div className="ico"><IconBank /></div><h4>Maximum possible loss</h4><p>One conservative number per asset: what could leave with no delay, what could leave within a day, and how long the largest transfers wait. Assumptions stated, never a guarantee.</p></div>
            <div><div className="ico"><IconTx /></div><h4>Posture indicator</h4><p>Confirmed controls and obvious weaknesses, in plain words. It does not claim to measure absolute security.</p></div>
          </Reveal>
          <Reveal>
            <div style={{ maxWidth: 900, margin: "48px auto 0", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 60px rgba(33,37,41,0.18)" }}><AppMockup variant="policy" /></div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
