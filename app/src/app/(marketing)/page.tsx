'use client';

import Link from 'next/link';
import { MarketingShell } from '@/marketing/Shell';
import { AppMockup, PhoneMockup } from '@/marketing/Mockup';
import { ScoreTicker } from '@/marketing/Ticker';
import { Reveal } from '@/marketing/Reveal';
import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
} from '@/marketing/icons';
import { useCountUp } from '@/marketing/motion';
import { NETWORK } from '@/config';

function Stat({ n, label }: { n: number; label: string }) {
  const { ref, value } = useCountUp(n, 1400);
  return (
    <div>
      <span className="v" ref={ref} style={{ display: 'block' }}>
        {value}
      </span>
      <div className="l">{label}</div>
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    'What is Skur?',
    'A self-custodial treasury vault on Sui whose authorization requirements rise and fall with the risk of each payment. It keeps the k-of-n approval you already trust and adds onchain rules about how much can move, where it can go, how fast, and how long the risky ones wait.',
  ],
  [
    'How is this different from a multisig?',
    'A multisig asks one question: did enough keys sign? Skur asks a second one: should this payment settle right now? The amount, its share of holdings, the recipient’s standing, what already left today and the vault’s security posture all sit between a valid approval and the money. Sui has signature aggregation in the protocol already — that is not what is missing.',
  ],
  [
    'Does Skur ever hold funds or keys?',
    'No. The vault is a shared object that holds the assets; your wallets hold the keys. No Skur service is in the execution path. The indexer makes a dashboard faster and can be switched off without affecting your ability to move money, read the policy or approve a payment.',
  ],
  [
    'What happens if one of our signers is compromised?',
    'Alone, a stolen key cannot reach any tier’s threshold unless you set that tier to one — and even then it is bounded by the routine maximum, the per-payment cap, the day’s remaining allowance and the loss envelope. If several keys are stolen, the larger payments still wait out a delay any guardian can use to veto, and the envelope freezes the vault on the first attempt that would cross it.',
  ],
  [
    'What can a guardian do?',
    'Freeze the vault, veto a critical payment or any weakening of the policy, confirm the largest payments, block a recipient immediately, and start a recovery for a lost signer. A guardian holds no treasury role — the contract refuses to give it one — so a stolen guardian key cannot move a single coin.',
  ],
  [
    'Can an automated agent use it?',
    'Yes, and this is the part a threshold cannot express. An agent holds a proposer role: it can open a payment and nothing else. It cannot approve, confirm or execute. A fully compromised agent key produces a queue of proposals that no human approved.',
  ],
  [
    'Why Sui, and why Move?',
    'A vault is one shared object, so “what are the rules right now” is a single read. Programmable transaction blocks make creation atomic without a factory. sui::clock gives millisecond time in the transaction, so timelocks are durations rather than block arithmetic. And the treasury is keyed by coin type, so one vault holds any asset with its own limits and its own envelope — no token allowlist to maintain or get wrong.',
  ],
  [
    'Has it been audited?',
    'No. The Move core is covered by two test suites, each test named after the attack it defends against, and the TypeScript engines are pinned against the same vectors. That is not an audit. Do not put real value behind Skur before one is complete.',
  ],
];

const HERO_CELLS: [number, number][] = [
  [0, 130],
  [130, 260],
  [1180, 0],
  [1310, 0],
  [1310, 130],
  [910, 390],
  [1050, 260],
  [520, 0],
];

export default function Landing() {
  const words = 'Treasury security that'.split(' ');

  return (
    <MarketingShell page="landing">
      <div className="announce">
        <Link href="/security">
          Every control runs in Move, in a shared object you can read <span>→</span>
        </Link>
      </div>

      <section className="hero">
        <div className="grid-bg" />
        {HERO_CELLS.map(([x, y], i) => (
          <span
            key={i}
            className="cell"
            style={{
              left: x,
              top: y,
              animationDelay: `${i * 0.55}s`,
              animationDuration: `${5 + (i % 4)}s`,
            }}
          />
        ))}
        <div className="wrap">
          <div className="eyebrow">
            <b>16 invariants</b> enforced by the vault, not by a server
          </div>
          <h1>
            {words.map((w, i) => (
              <span key={i}>
                <span
                  className="w"
                  style={{ animation: `rise 0.7s var(--ease) ${0.08 + i * 0.06}s both` }}
                >
                  {w}
                </span>{' '}
              </span>
            ))}
            <span className="mark-hl">
              {['assumes', 'compromise'].map((w, i) => (
                <span key={w}>
                  <span
                    className="w"
                    style={{
                      animation: `rise 0.7s var(--ease) ${0.08 + (words.length + i) * 0.06}s both`,
                    }}
                  >
                    {w}
                  </span>
                  {i === 0 ? ' ' : ''}
                </span>
              ))}
            </span>
          </h1>
          <p className="sub">
            An approval proves someone was authorized. Skur decides whether the payment is safe:
            how much can move, where it can go, how fast, and how long the risky ones wait — even
            when your signers are compromised.
          </p>
          <div className="cta-row">
            <Link className="btn btn-accent btn-lg" href="/app">
              Launch app <IconChevronRight width={16} height={16} />
            </Link>
            <Link className="btn btn-white btn-lg" href="/product">
              See how it works
            </Link>
          </div>
          <div className="hero-meta">
            <span>Self-custodial</span>
            <span>Sui · {NETWORK}</span>
            <span>Enforced in Move</span>
          </div>
          <div className="mockwrap">
            <div className="mock">
              <AppMockup />
            </div>
            <div className="float">
              <ScoreTicker />
            </div>
            <div className="float-phone">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>
      <div className="tape" />

      <section className="light" style={{ paddingTop: 72 }}>
        <div className="wrap center" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 style={{ fontSize: 30 }}>Made for organizations that hold real money onchain</h2>
            <p className="lead" style={{ marginBottom: 32 }}>
              Startups, protocols, funds, payment companies, nonprofits and family offices that need
              more than a signature count between a stolen key and the treasury.
            </p>
          </Reveal>
          <div className="marquee">
            <div className="track">
              {[...Array(2)].flatMap((_, k) =>
                [
                  'Startups',
                  'Protocols & DAOs',
                  'Venture funds',
                  'Payment companies',
                  'Nonprofits',
                  'Family offices',
                  'Finance teams',
                  'Grant programmes',
                ].map((t) => (
                  <span key={`${k}-${t}`} className="chip-l">
                    {t}
                  </span>
                )),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dark" id="product">
        <div className="wrap">
          <Reveal>
            <div className="secno">01 / Controls</div>
            <h2>Your treasury, under control</h2>
            <p className="lead">
              Every rule below is Move code in a shared object, not a setting on our server. If Skur
              disappeared tomorrow, your vault and its policy would not.
            </p>
          </Reveal>
          <Reveal stagger className="bento">
            <div className="bcard big center">
              <h3>Risk-tiered authorization</h3>
              <p>
                The vault scores every payment from its amount, its share of holdings, who receives
                it, what already left today and the current security mode. The score sets how many
                approvals it needs, whether a guardian must sign, and how long it waits.
              </p>
              <div
                className="art"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: 24,
                  maxWidth: 820,
                  margin: '0 auto',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                  {[
                    '1,000 USDC to a known supplier',
                    '12,000 USDC to a new address',
                    '60,000 USDC, 24% of holdings',
                  ].map((t) => (
                    <span key={t} style={{ background: '#343a40', padding: '10px 16px', borderRadius: 8, fontSize: 14 }}>
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    border: '6px solid #343a40',
                    boxShadow: '0 0 0 2px #ffd000 inset',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#212529',
                    fontWeight: 800,
                    color: '#fff',
                    animation: 'float 4s ease-in-out infinite',
                  }}
                >
                  S
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ background: '#ffd000', color: '#212529', padding: '10px 16px', borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                    Routine · 1 approval · executes now
                  </span>
                  <span style={{ background: '#4d3a05', color: '#fff3cd', padding: '10px 16px', borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                    High risk · 2 approvals · waits 1 day
                  </span>
                  <span style={{ background: '#4a1c22', color: '#f8d7da', padding: '10px 16px', borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                    Critical · 2 + a guardian · 1 day · vetoable
                  </span>
                </div>
              </div>
            </div>

            <div className="bcard">
              <h3>Recipient trust</h3>
              <p>
                Recipients are security objects, not strings. An address the vault has never paid is
                escalated every time. A newly registered one serves an activation delay before it
                can be paid at all.
              </p>
              <div className="art" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['New', 'activates in 23h', '#1b3a5c', '#cfe2ff', '0x7c4f…41e2'],
                  ['Verified', 'normal policy', '#1b4332', '#d1e7dd', '0x3a91…c0de'],
                  ['Restricted', 'always critical', '#4d3a05', '#fff3cd', '0xe2b7…9f10'],
                  ['Blocked', 'refused', '#4a1c22', '#f8d7da', '0x0d55…77aa'],
                ].map(([s, d, bg, fg, addr]) => (
                  <div
                    key={s}
                    style={{ display: 'flex', justifyContent: 'space-between', background: '#212529', padding: '12px 14px', borderRadius: 6 }}
                  >
                    <span className="mono" style={{ fontSize: 13 }}>
                      {addr}
                    </span>
                    <span style={{ background: bg, color: fg, padding: '2px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                      {s} · {d}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bcard">
              <h3>Cumulative limits</h3>
              <p>
                Per-payment and 24-hour caps, counted against what has already left. Crossing half
                the day’s allowance escalates everything after it, so splitting a drain into twenty
                pieces meets a higher bar partway through instead of never.
              </p>
              <div className="art" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Payment 1–5', '49,500 USDC', 'Routine'],
                  ['Payment 6', 'half the day gone', 'Escalated'],
                  ['Payment 11', 'envelope crossed', 'Refused'],
                ].map(([a, b, c]) => (
                  <div key={a} style={{ display: 'flex', justifyContent: 'space-between', background: '#212529', padding: '12px 14px', borderRadius: 6, fontSize: 13 }}>
                    <span>{a}</span>
                    <span className="mono">{b}</span>
                    <span style={{ fontWeight: 700 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bcard">
              <h3>A circuit breaker that latches</h3>
              <p>
                A share of the balance that may leave per window, measured against the balance when
                the window opened. The payment that would cross it is not made — the vault freezes
                instead, and the freeze survives the attempt.
              </p>
            </div>

            <div className="bcard">
              <h3>An agent that cannot pay itself</h3>
              <p>
                Software that requests payments holds a proposer role: it can open one and nothing
                else. A compromised automation key produces a queue nobody approved, not a
                withdrawal. No threshold product can express this, because to a threshold every key
                is the same kind of key.
              </p>
              <Link href="/docs/agents" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                How the agent role works <IconArrowRight width={16} height={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="white" id="firewall">
        <div className="wrap">
          <Reveal>
            <div className="secno">02 / The firewall</div>
            <h2>Weakening the vault is the attack</h2>
            <p className="lead">
              An attacker with enough keys does not withdraw first. They lower the thresholds, widen
              the caps and shorten the delays, and then withdraw. So that is the path Skur guards
              hardest.
            </p>
          </Reveal>
          <Reveal className="shield">
            <div>
              <h2 style={{ fontSize: 32 }}>Tightening is instant. Loosening is not.</h2>
              <p>
                Every policy change is compared field by field against the live one — including the
                cases that look like tightening and are not, such as setting a threshold to zero to
                disable it, or extending how long a proposal stays alive.
              </p>
              <ul>
                <li>
                  <IconCheck /> Loosening any control waits out the policy-change delay
                </li>
                <li>
                  <IconCheck /> Any guardian can veto it inside that window
                </li>
                <li>
                  <IconCheck /> Lockdown refuses to let it be proposed at all
                </li>
              </ul>
            </div>
            <div className="tilt">
              <AppMockup variant="queue" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="secno">03 / Compared</div>
            <h2>What else a Sui treasury can use today</h2>
          </Reveal>
          <Reveal className="compare">
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="hl">Skur</th>
                  <th>Native multisig</th>
                  <th>Smart-account frameworks</th>
                  <th>Offchain policy custody</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Authorization</td>
                  <td className="hl">Follows the risk of the payment</td>
                  <td>Fixed k-of-n</td>
                  <td>Fixed, per config</td>
                  <td>Configurable, offchain</td>
                </tr>
                <tr>
                  <td>Cumulative outflow</td>
                  <td className="hl">Counted per asset, split-proof</td>
                  <td>Not expressible</td>
                  <td>Not implemented</td>
                  <td>Provider-dependent</td>
                </tr>
                <tr>
                  <td>Enough signers compromised</td>
                  <td className="hl">Caps, delays, veto and a breaker</td>
                  <td>Funds gone</td>
                  <td>Funds gone</td>
                  <td>Depends on the provider</td>
                </tr>
                <tr>
                  <td>Policy tampering</td>
                  <td className="hl">Delayed, vetoable, refused in Lockdown</td>
                  <td>No policy to tamper with</td>
                  <td>Immediate</td>
                  <td>Provider-controlled</td>
                </tr>
                <tr>
                  <td>Where the rules live</td>
                  <td className="hl">A shared object anyone can read</td>
                  <td>In the protocol</td>
                  <td>Onchain</td>
                  <td>Somebody’s backend</td>
                </tr>
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="dark" style={{ paddingTop: 0 }}>
        <Reveal className="wrap quote">
          <blockquote>
            &ldquo;Control not only who can move treasury funds, but how much can move, where it can
            go, and what happens when risk changes.&rdquo;
          </blockquote>
          <cite>The Skur thesis</cite>
          <div className="stats">
            <Stat n={16} label="Invariants, each with a test" />
            <Stat n={4} label="Move modules in the core" />
            <Stat n={0} label="Servers between you and your vault" />
          </div>
        </Reveal>
      </section>

      <section className="light" id="solutions">
        <div className="wrap">
          <Reveal>
            <div className="secno">04 / Who it is for</div>
            <h2>Two kinds of power, held by different people</h2>
            <p className="lead">
              Finance teams move the money. Guardians hold the brake. The contract will not let one
              address do both jobs.
            </p>
          </Reveal>
          <Reveal stagger className="audiences">
            <div className="acard">
              <h3>For finance teams</h3>
              <p>
                Tiered approvals, trusted recipients, daily caps, and a plain-language review — read
                from the vault itself — before any wallet opens.
              </p>
              <Link href="/solutions">
                How teams use Skur <IconArrowRight width={16} height={16} />
              </Link>
              <div className="art">
                <AppMockup />
              </div>
            </div>
            <div className="acard">
              <h3>For guardians</h3>
              <p>
                Freeze the vault, veto the critical and the security-reducing, confirm the largest
                payments, block a recipient on the spot, recover a lost signer. Never touch a coin.
              </p>
              <Link href="/solutions#guardians">
                What a guardian can do <IconArrowRight width={16} height={16} />
              </Link>
              <div className="art art-phone">
                <PhoneMockup variant="security" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <div className="secno">05 / Lifecycle</div>
            <h2>How a payment moves</h2>
            <p className="lead">
              Requirements are pinned at step one. Everything is checked again at step four, and the
              stricter of the two applies.
            </p>
          </Reveal>
          <Reveal stagger className="steps4">
            <div>
              <div className="n">1</div>
              <h4>Opened and scored</h4>
              <p>
                The vault reads the amount, its share of holdings, the recipient’s standing, today’s
                outflow and the security mode, then pins the tier and its requirements to the
                proposal.
              </p>
            </div>
            <div>
              <div className="n">2</div>
              <h4>Reviewed in plain language</h4>
              <p>
                Approvers see what leaves, what remains, who receives it and every reason the tier
                was assigned — read from the vault, not computed by the interface.
              </p>
            </div>
            <div>
              <div className="n">3</div>
              <h4>Confirmed, or vetoed</h4>
              <p>
                Approvals are recounted against the live roster, so a removed signer’s approval stops
                counting. Any guardian can veto a critical or security-reducing proposal until it
                executes.
              </p>
            </div>
            <div>
              <div className="n">4</div>
              <h4>Executed only if still safe</h4>
              <p>
                Caps, exposure, the recipient’s standing and the loss envelope are all re-checked.
                Over the envelope, the vault freezes instead of paying.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="white" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="secno">06 / Questions</div>
            <h2>Questions, answered plainly</h2>
          </Reveal>
          <Reveal className="faq">
            <div style={{ marginTop: 48 }}>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span className="plus">+</span>
                  </summary>
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
