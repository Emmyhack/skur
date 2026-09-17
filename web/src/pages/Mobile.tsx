import { MarketingShell, SubHero } from "../components/MarketingShell";
import { PhoneMockup } from "../components/PhoneMockup";
import { Reveal } from "../components/Reveal";
import { IconBook, IconClock, IconGuard, IconLab, IconShield, IconTx } from "../components/icons";

export function Mobile({ onLaunch }: { onLaunch: () => void }) {
  return (
    <MarketingShell page="mobile" onLaunch={onLaunch}>
      <SubHero eyebrow="MOBILE" title={<>The vault<br />in your pocket</>} sub="Read the treasury, review what is waiting, and sign with the key on your phone. The same contracts, the same policy, no server in between." onLaunch={onLaunch}>
        <a className="btn btn-white btn-lg" href="https://github.com/Emmyhack/skur/tree/main/mobile" target="_blank" rel="noreferrer">Build it yourself</a>
      </SubHero>

      <section className="white" style={{ paddingTop: 64 }}>
        <div className="wrap">
          <Reveal className="phones">
            <PhoneMockup variant="home" label="Skur mobile, the vault's assets" />
            <PhoneMockup variant="confirm" label="Skur mobile, confirming a payment" />
            <PhoneMockup variant="queue" label="Skur mobile, the queue" />
          </Reveal>
        </div>
      </section>

      <section className="light">
        <div className="wrap">
          <Reveal>
            <div className="secno">01 / On the phone</div>
            <h2>Everything the desktop does</h2>
            <p className="lead">Balances, the queue, the policy editor, members, the address book, the attack simulator and recovery. Nothing is read-only because you are on a phone.</p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div><div className="ico"><IconTx /></div><h4>Sign where you are</h4><p>A key created on the phone and kept in its keychain, behind Face ID or Touch ID. Nothing leaves the device but a signed transaction.</p></div>
            <div><div className="ico"><IconShield /></div><h4>Checked before you sign</h4><p>Every payment is simulated against the vault first, so a refusal reads as plain language rather than a failed transaction.</p></div>
            <div><div className="ico"><IconClock /></div><h4>Told when you are needed</h4><p>A notification when a proposal newly needs your confirmation, and a tap takes you straight to it.</p></div>
            <div><div className="ico"><IconGuard /></div><h4>Freeze from anywhere</h4><p>Guardians can raise the mode or veto a proposal from the phone the moment something looks wrong.</p></div>
            <div><div className="ico"><IconBook /></div><h4>Scan, do not type</h4><p>The camera reads a vault or recipient address, so a 42-character address is never typed on a phone keyboard.</p></div>
            <div><div className="ico"><IconLab /></div><h4>Test the policy</h4><p>The same attack scenarios as the desktop simulator, run against the live policy or any template.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="dark">
        <div className="wrap">
          <Reveal>
            <div className="secno">02 / Keys</div>
            <h2>No wallet connection to lose</h2>
            <p className="lead">The phone holds its own signer. Give that address a role in the vault and it signs; without a role the app is a reader.</p>
          </Reveal>
          <Reveal className="dashed">
            <div><h4>Created on the device</h4><p>Generated on the phone or imported, stored in the keychain, never synced anywhere.</p></div>
            <div><h4>Several keys, one phone</h4><p>Hold an approver key and a guardian key side by side and choose which one signs.</p></div>
            <div><h4>Biometrics before every signature</h4><p>Face ID or Touch ID gates each signature, and can be turned off for a device you keep offline.</p></div>
            <div><h4>Losing the phone is recoverable</h4><p>Guardians replace a lost signer after a delay any owner can cancel. The policy is untouched.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="white">
        <div className="wrap center" style={{ textAlign: "center" }}>
          <Reveal>
            <h2>Built with Expo and React Native</h2>
            <p className="lead">iOS and Android from one codebase, sharing the risk engine, policy rules and contract reads with this website. Not on the stores yet: build it from the repository.</p>
            <a className="btn btn-black btn-lg" href="https://github.com/Emmyhack/skur/tree/main/mobile" target="_blank" rel="noreferrer">Read the mobile README</a>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
