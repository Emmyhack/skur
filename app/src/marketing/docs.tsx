'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { POLICY_GROUPS, TEMPLATES, fmtDuration } from '@skur/sdk';
import { CONFIGURED, NETWORK, PACKAGE_ID } from '@/config';
import { MarketingShell } from './Shell';

export type DocSlug =
  | 'introduction'
  | 'quick-start'
  | 'roles'
  | 'risk-tiers'
  | 'policy'
  | 'recipients'
  | 'limits'
  | 'modes'
  | 'changes'
  | 'recovery'
  | 'agents'
  | 'move-package'
  | 'invariants'
  | 'limitations';

type Doc = { slug: DocSlug; title: string; group: string; body: () => ReactNode };

const H = ({ children }: { children: ReactNode }) => (
  <h3 id={String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-')}>{children}</h3>
);
const Note = ({ children }: { children: ReactNode }) => <div className="doc-note">{children}</div>;

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="doc-table">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REPO = 'https://github.com/Emmyhack/skur';

const DOCS: Doc[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    group: 'Start',
    body: () => (
      <>
        <p className="doc-lead">
          Skur is a programmable authorization and treasury security layer for Sui organizations: a
          self-custodial vault whose requirements rise and fall with the risk of each payment.
        </p>
        <p>
          A multisig asks one question — did enough keys sign? Skur asks a second one: should this
          payment settle right now? Between a valid approval and the money sit amount tiers,
          recipient standing, velocity caps, a loss envelope, guardian veto and a firewall around
          policy changes. Every one is enforced by the Move code in a shared object, not by a
          server.
        </p>
        <H>Why this is not a multisig</H>
        <p>
          Sui has signature aggregation in the protocol: a multisig address can hold up to ten keys
          with weights and mixed schemes, for free. That is not the part that is missing. What is
          missing is anything that depends on <b>what</b> the transaction does, <b>who</b> receives
          it, or <b>what has already happened today</b> — and that is the whole of Skur.
        </p>
        <H>What Skur does not claim</H>
        <p>
          Skur does not make signer compromise harmless. It limits and delays the damage when
          authorized credentials are misused. A stolen key alone cannot reach a tier’s threshold
          unless you set that tier to one, and even then it is bounded by the per-payment cap, the
          day’s remaining allowance and the loss envelope.
        </p>
        <Note>
          Skur has not been audited and is not deployed to mainnet. Do not put real value behind it
          until an independent audit is complete.
        </Note>
      </>
    ),
  },
  {
    slug: 'quick-start',
    title: 'Quick start',
    group: 'Start',
    body: () => (
      <>
        <p className="doc-lead">Reading a vault needs no wallet. Acting on one needs the key that holds the role.</p>
        <H>Open a vault</H>
        <p>
          A vault is a shared object, so anyone can read it: the balances, the queue, the policy and
          the security posture all come from the chain. Paste a vault id into the app, or connect a
          wallet to see the vaults you hold a role in.
        </p>
        <H>Create your own</H>
        <ol>
          <li>Connect a wallet on Sui {NETWORK}.</li>
          <li>
            Pick the template closest to your organization. Every value can be changed later through
            governance — tightening takes effect at once, loosening waits.
          </li>
          <li>
            List the signers and their roles. Owners govern, approvers confirm payments, executors
            execute, proposers can only ask, guardians hold the brake.
          </li>
          <li>
            Sign once. One transaction creates the vault, sets the policy, installs the roster and
            approves the first asset — and if any part is invalid, nothing is created.
          </li>
        </ol>
        <H>Open a payment</H>
        <p>
          Enter the recipient, the asset and the amount. Before the wallet opens, the vault itself
          classifies the payment: the tier, the approvals it needs, whether a guardian must sign,
          how long it waits, and every reason. That preview is a simulation of the same function
          execution runs, so it cannot promise something the vault would refuse.
        </p>
        <H>Run it yourself</H>
        <p>
          The Move package, the SDK, the indexer and this interface are all in{' '}
          <a href={REPO} target="_blank" rel="noreferrer">
            the repository
          </a>
          . <code>sui move test</code> runs the security suite; each test is named after the attack
          it defends against.
        </p>
      </>
    ),
  },
  {
    slug: 'roles',
    title: 'Roles',
    group: 'Model',
    body: () => (
      <>
        <p className="doc-lead">
          Five roles, held as a bitmask. A member can hold several treasury roles; a guardian can
          hold none.
        </p>
        <Table
          head={['Role', 'Can', 'Cannot']}
          rows={[
            [
              'Owner (1)',
              'Open and approve governance: the policy, asset limits, the roster, recipient trust, lowering the mode. Register a recipient. Cancel any proposal',
              'Move funds without meeting the payment policy',
            ],
            ['Approver (2)', 'Approve a payment', 'Execute one, or govern'],
            ['Executor (4)', 'Execute a payment once every condition holds', 'Approve one'],
            [
              'Guardian (8)',
              'Freeze the vault, veto, confirm critical payments, block a recipient alone, open a recovery',
              'Open, approve or execute a payment, govern, or hold any treasury role',
            ],
            [
              'Proposer (16)',
              'Open a proposal',
              'Approve, confirm, execute, govern, or be a guardian',
            ],
          ]}
        />
        <H>Why guardians are exclusive</H>
        <p>
          The contract refuses to give a guardian a treasury role, and refuses to give a treasury
          member the guardian role. Every path that writes a role goes through the same check, so
          there is no way to install an exception. That makes guardians a second control plane an
          attacker has to breach separately — and one they cannot profit from, because there is no
          withdrawal path from guardian authority.
        </p>
        <H>Why approvals are recounted</H>
        <p>
          An approval is recorded against the address, not counted into a number. At execution the
          set is recounted against the live roster, so a signer removed after approving stops
          counting. A tally frozen at approval time would let a compromised key’s approval outlive
          its removal.
        </p>
      </>
    ),
  },
  {
    slug: 'risk-tiers',
    title: 'Risk tiers',
    group: 'Model',
    body: () => (
      <>
        <p className="doc-lead">
          Every payment is scored when it is opened. Five signals, each able to raise the tier and
          none able to lower it.
        </p>
        <Table
          head={['Signal', 'What raises the tier']}
          rows={[
            ['Amount', 'Above the asset’s routine maximum is high risk; above its high maximum is critical'],
            ['Share of holdings', 'Above the high exposure threshold escalates; above the critical one makes it critical'],
            ['Recipient', 'Never paid, or still in its activation delay, escalates one step. Restricted is always critical. Blocked is refused'],
            ['Velocity', 'Past half the day’s allowance for that asset escalates to at least high risk'],
            ['Posture', 'Elevated escalates everything one step and halves the caps'],
          ]}
        />
        <H>What a tier costs</H>
        <Table
          head={['Tier', 'Approvals', 'Guardian', 'Wait']}
          rows={[
            ['Routine', 'approvalsLow', 'none', 'none'],
            ['High risk', 'approvalsHigh', 'none', 'delayHigh'],
            ['Critical', 'approvalsCritical', 'guardianThreshold, if required', 'delayCritical'],
          ]}
        />
        <H>Pinned, then tighten-only</H>
        <p>
          The requirements are pinned to the proposal when it is opened. At execution the payment is
          reclassified against live state and the <b>stricter</b> of the pinned and live
          requirements applies. Tightening the policy affects payments already in flight; loosening
          it cannot rescue one.
        </p>
        <Note>
          Exposure is computed per asset, as a share of that asset’s own balance. A vault holding
          several coin types has several independent calculations and no portfolio-wide number —
          producing one would need a price oracle, and a wrong portfolio number is worse than an
          honest per-asset one.
        </Note>
      </>
    ),
  },
  {
    slug: 'policy',
    title: 'The policy',
    group: 'Model',
    body: () => (
      <>
        <p className="doc-lead">
          Seventeen fields. Durations are stored in milliseconds, because that is what{' '}
          <code>sui::clock</code> reports.
        </p>
        {POLICY_GROUPS.map((g) => (
          <div key={g.title}>
            <H>{g.title}</H>
            <p>{g.sub}</p>
            <Table
              head={['Field', 'Unit', 'What it does']}
              rows={g.fields.map((f) => [
                <code key={f.key}>{f.key}</code>,
                f.unit === 'hours' ? 'hours' : f.unit === 'bps' ? 'percent' : f.unit === 'bool' ? 'on/off' : 'count',
                `${f.label}${f.hint ? ` — ${f.hint}` : ''}`,
              ])}
            />
          </div>
        ))}
        <H>Coherence rules the vault enforces</H>
        <ul>
          <li>Approvals must be monotonic: routine ≤ high risk ≤ critical.</li>
          <li>The critical delay cannot be shorter than the high-risk delay.</li>
          <li>The high exposure threshold cannot exceed the critical one, and neither can exceed 100%.</li>
          <li>The hard block cannot sit below the critical exposure threshold.</li>
          <li>The envelope window must be at least an hour when the envelope is on.</li>
          <li>
            The proposal lifetime must exceed the longest delay by at least an hour — otherwise a
            payment could expire before its own timelock elapsed.
          </li>
          <li>
            The roster must be able to satisfy the thresholds. A threshold nobody can reach is a
            frozen vault, and the contract refuses to create or leave one.
          </li>
        </ul>
        <H>Starting points</H>
        <Table
          head={['Template', 'For', 'Critical wait', 'New recipient', 'Envelope']}
          rows={TEMPLATES.map((t) => [
            <b key={t.id}>{t.name}</b>,
            t.audience,
            fmtDuration(t.policy.delayCritical),
            fmtDuration(t.policy.recipientActivationDelay),
            `${t.policy.envelopeBps / 100}% / ${fmtDuration(t.policy.envelopeWindow)}`,
          ])}
        />
      </>
    ),
  },
  {
    slug: 'recipients',
    title: 'Recipients',
    group: 'Model',
    body: () => (
      <>
        <p className="doc-lead">
          A recipient is a security object with a standing and a clock, not a string in a form.
        </p>
        <Table
          head={['Standing', 'Effect']}
          rows={[
            ['Never paid', 'Escalated one step, every time, for as long as it stays unregistered'],
            ['New', 'Escalated until its activation delay has elapsed, then treated normally'],
            ['Verified', 'Normal policy'],
            ['Trusted', 'Normal policy. Trust never discounts a payment below its amount tier'],
            ['Restricted', 'Always critical'],
            ['Blocked', 'Refused outright, at proposal and again at execution'],
          ]}
        />
        <H>The activation delay</H>
        <p>
          Registering a recipient starts it at <b>New</b> with an activation delay. A payment to it
          cannot execute before that moment — the tier’s delay and the activation delay run
          concurrently and the later one governs. Re-checked at execution, so a payment approved
          early still waits.
        </p>
        <H>Raising and lowering trust</H>
        <p>
          Registering is immediate, because New with a delay is stricter than never-paid. Raising
          trust beyond that is a governance action that waits out the policy-change delay and can be
          vetoed. Restricting or blocking is immediate on an owner threshold — and a guardian can
          block a recipient alone, instantly. That is the one unilateral power in the system, and it
          can only ever stop money.
        </p>
        <Note>
          Paying an address does not promote it. Only governance changes trust, so a payment to a
          never-registered address is escalated every time, forever. This is intended, and
          occasionally surprising.
        </Note>
      </>
    ),
  },
  {
    slug: 'limits',
    title: 'Limits and the breaker',
    group: 'Reference',
    body: () => (
      <>
        <p className="doc-lead">
          Per-asset caps bound a single payment. Cumulative accounting bounds a campaign of them.
        </p>
        <Table
          head={['Control', 'Scope', 'What it does']}
          rows={[
            ['Routine maximum', 'per asset', 'Above it, a payment is at least high risk'],
            ['High maximum', 'per asset', 'Above it, a payment is critical'],
            ['Per-payment cap', 'per asset', 'A hard ceiling on one payment. Zero means no cap'],
            ['Daily cap', 'per asset', 'A ceiling on the 24-hour bucket, counted cumulatively'],
            ['Hard block', 'share of asset', 'A share no amount of approval can clear'],
            ['Loss envelope', 'share of asset', 'A ceiling on outflow per window. Crossing it freezes the vault'],
          ]}
        />
        <H>Why splitting does not work</H>
        <p>
          The day’s outflow is counted, not inferred. Crossing half the day’s allowance escalates
          every further payment to at least high risk, so a drain split into twenty pieces meets a
          higher bar partway through rather than at the end — and the daily cap refuses the piece
          that would cross it.
        </p>
        <H>The envelope, and its basis</H>
        <p>
          The envelope is a share of the balance <b>when the window opened</b>, not of the live
          balance. Measuring against the live balance would let a drain shrink its own denominator
          and keep every later payment under the same percentage. The cost of this choice is that a
          large deposit mid-window does not raise the window’s allowance until the window rolls.
        </p>
        <H>Why the breaker does not revert</H>
        <p>
          When a payment would cross the envelope, the vault marks the proposal refused, enters
          Lockdown, emits an event — and the transaction <b>succeeds</b>. The coin is never moved.
          Aborting would be the obvious thing and it would be wrong: the abort would roll back the
          Lockdown along with everything else, leaving the vault open and the attacker free to try
          again for the price of gas.
        </p>
        <Note>
          A 24-hour bucket anchors on its first charge rather than sliding, so up to two days’
          allowance can leave across a boundary. The envelope and the per-payment cap bound that,
          and the maximum-loss view states it rather than assuming the best case.
        </Note>
      </>
    ),
  },
  {
    slug: 'modes',
    title: 'Security modes',
    group: 'Reference',
    body: () => (
      <>
        <p className="doc-lead">Three postures. Raising one is immediate. Lowering one never is.</p>
        <Table
          head={['Mode', 'Effect', 'Who can enter it']}
          rows={[
            ['Normal', 'The policy as written', '—'],
            [
              'Elevated',
              'Every payment escalated one step; per-payment and daily caps halved, never below one unit',
              'Any member',
            ],
            [
              'Lockdown',
              'No outgoing execution and no new payments. Deposits still work',
              'Any owner or guardian',
            ],
          ]}
        />
        <H>Leaving a raised posture</H>
        <p>
          It takes owners, a guardian and time, in that order: an owner threshold of approvals, the
          guardian threshold of confirmations, and the policy-change delay. Whoever raised the
          posture cannot lower it alone, which is the point.
        </p>
        <H>What else raises it</H>
        <ul>
          <li>A guardian veto moves a Normal vault to Elevated — reaching for the brake is itself a signal.</li>
          <li>A completed recovery leaves the vault Elevated, because a recovery means something went wrong.</li>
          <li>The circuit breaker latches straight to Lockdown.</li>
        </ul>
        <Note>
          Deposits are never gated, in any mode, from any address. The controls exist to govern money
          leaving; refusing money arriving would only strand it.
        </Note>
      </>
    ),
  },
  {
    slug: 'changes',
    title: 'Changing the policy',
    group: 'Reference',
    body: () => (
      <>
        <p className="doc-lead">
          An attacker with enough keys does not withdraw first. They weaken the policy, then
          withdraw. So this is the path guarded hardest.
        </p>
        <H>What counts as weakening</H>
        <p>
          Every change is compared to the live policy field by field. The interesting cases are the
          ones where a number going <b>down</b> is a loosening:
        </p>
        <ul>
          <li>
            <b>Setting a threshold to zero</b> disables it, which is the loosest possible move — so
            moving to zero is a weakening and moving away from zero can only tighten.
          </li>
          <li>
            <b>A longer proposal lifetime</b> keeps a stale approval set alive for longer, so it
            weakens the vault even though the number went up.
          </li>
          <li>
            <b>Granting a role</b> to an address that did not hold one is a new way in, so adding a
            signer is treated as a weakening while removing one is not.
          </li>
          <li>
            <b>Lifting a restriction</b> on a recipient weakens the vault; imposing one does not.
          </li>
        </ul>
        <H>What a weakening costs</H>
        <ol className="doc-inv">
          <li>An owner threshold of approvals, as with any governance action.</li>
          <li>The policy-change delay, which runs before it can take effect.</li>
          <li>A veto window: any guardian can stop it outright until it executes.</li>
          <li>And it cannot be opened at all while the vault is in Lockdown.</li>
        </ol>
        <p>
          A change that only tightens the vault skips all of that and takes effect as soon as owners
          agree. The policy is also re-validated against the roster at execution, not only when
          proposed, so a change that became incoherent in the meantime is refused.
        </p>
      </>
    ),
  },
  {
    slug: 'recovery',
    title: 'Recovery',
    group: 'Reference',
    body: () => (
      <>
        <p className="doc-lead">A lost key should not cost the treasury, and a stolen guardian key should not gain it.</p>
        <H>How it works</H>
        <ol className="doc-inv">
          <li>A guardian opens a recovery naming the lost signer and the replacement.</li>
          <li>The guardian threshold of confirmations is required.</li>
          <li>The recovery delay runs. Any owner can cancel it during that time.</li>
          <li>
            On execution the roles move across unchanged — whatever the lost signer holds at that
            moment, not what they held when it was proposed.
          </li>
          <li>The policy is untouched, and the vault comes out of it in Elevated.</li>
        </ol>
        <H>What it cannot do</H>
        <ul>
          <li>It cannot change the policy, the limits or anyone else’s roles.</li>
          <li>It cannot name an address that is already a member.</li>
          <li>A guardian cannot nominate themselves as the replacement.</li>
          <li>It cannot leave the roster unable to satisfy the policy.</li>
        </ul>
        <Note>
          With a single guardian, one key both opens the recovery and confirms it. The owner cancel
          is what bounds that, and the protocol, fund and larger templates ship with two guardians
          for exactly this reason.
        </Note>
      </>
    ),
  },
  {
    slug: 'agents',
    title: 'Automated proposers',
    group: 'Reference',
    body: () => (
      <>
        <p className="doc-lead">
          An organization increasingly wants software to <b>request</b> payments. Nobody sensibly
          wants software to <b>authorize</b> them.
        </p>
        <p>
          An invoice processor, a rebalancer, an agent reading a vendor inbox: each needs to put a
          payment in front of people. Giving it a signing key in a multisig gives it a fraction of
          the authority to move money, because to a threshold every key is the same kind of key.
        </p>
        <H>The proposer role</H>
        <p>
          A member holding only <code>PROPOSER</code> can open a proposal and do nothing else. It
          cannot approve, cannot confirm, cannot execute, cannot govern, and cannot be a guardian.
          Its approval would not count even if it submitted one — the vault checks the approver role
          when counting, not merely membership.
        </p>
        <p>
          A fully compromised agent key therefore produces a queue of proposals that no human
          approved. That is the difference between an automation incident and a loss.
        </p>
        <H>What an agent still faces</H>
        <ul>
          <li>Everything it opens is scored like any other payment.</li>
          <li>Paying a new address is escalated and waits out the activation delay.</li>
          <li>Its payments count against the day’s allowance and the loss envelope like anyone’s.</li>
          <li>An agent that starts behaving oddly trips the same breaker a human would.</li>
        </ul>
        <Note>
          Give an automation its own key and its own role. Sharing a human’s key with a script is
          the thing this role exists to make unnecessary.
        </Note>
      </>
    ),
  },
  {
    slug: 'move-package',
    title: 'The Move package',
    group: 'Assurance',
    body: () => (
      <>
        <p className="doc-lead">
          Four modules. The three pure ones hold the rules; the fourth holds the state.
        </p>
        <Table
          head={['Module', 'What it is']}
          rows={[
            ['types', 'Role bits, tiers, trust levels, modes, proposal kinds, statuses, the reason mask'],
            ['policy', 'The seventeen fields, the limits, every validation rule, and the loosening comparison'],
            ['risk', 'The classifier: five signals in, a tier, a reason mask and an exposure out'],
            ['vault', 'The shared object, the proposal lifecycle, and every enforcement point'],
          ]}
        />
        <H>Reading order for a review</H>
        <ol className="doc-inv">
          <li>
            <code>risk::classify</code> — if this is wrong, every number the product shows is wrong.
          </li>
          <li>
            <code>policy::reductions</code> — the firewall, and the cases where a smaller number is
            a weakening.
          </li>
          <li>
            <code>vault::execute_transfer</code> — the last gate, where everything is re-evaluated
            against live state.
          </li>
          <li>
            <code>vault::begin</code> and <code>finish</code> — creation as a hot potato, so a
            half-configured vault is never reachable.
          </li>
        </ol>
        <H>Conventions</H>
        <ul>
          <li>Durations in milliseconds; amounts in the coin’s smallest unit.</li>
          <li>Any intermediate that could overflow is computed in 128-bit space.</li>
          <li>
            Validation returns a code and a separate function aborts with it, so an interface can
            dry-run a draft policy and show the precise reason.
          </li>
          <li>Zero means “no limit” for every cap and threshold. This is load-bearing.</li>
        </ul>
        {CONFIGURED ? (
          <>
            <H>This deployment</H>
            <Table
              head={['', '']}
              rows={[
                ['Network', `Sui ${NETWORK}`],
                [
                  'Package',
                  <a
                    key="pkg"
                    href={`https://suiscan.xyz/${NETWORK}/object/${PACKAGE_ID}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{PACKAGE_ID}</code>
                  </a>,
                ],
              ]}
            />
          </>
        ) : (
          <Note>
            No package is published for {NETWORK} yet. Publish with{' '}
            <code>sui/scripts/publish.sh</code>; it builds, runs the tests, and refuses to publish a
            package whose tests fail.
          </Note>
        )}
      </>
    ),
  },
  {
    slug: 'invariants',
    title: 'Invariants',
    group: 'Assurance',
    body: () => (
      <>
        <p className="doc-lead">
          Fifteen properties, each enforced by named code and proven by a test named after the
          attack it defends against.
        </p>
        <ol className="doc-inv">
          <li>Nothing executes before every active condition is met.</li>
          <li>A guardian cannot move treasury assets through guardian authority.</li>
          <li>Lockdown stops outgoing execution and new payments.</li>
          <li>A security-reducing change never takes effect immediately.</li>
          <li>Cumulative outflow cannot be bypassed by splitting.</li>
          <li>A proposal cannot execute twice.</li>
          <li>A removed signer’s approval stops counting.</li>
          <li>An approval cannot be duplicated or replayed.</li>
          <li>A new recipient cannot skip its activation delay.</li>
          <li>Recovery cannot quietly weaken the vault.</li>
          <li>Balance accounting reconciles.</li>
          <li>The roster always satisfies the policy.</li>
          <li>The breaker’s latch survives the attempt.</li>
          <li>Leaving a raised posture is never unilateral.</li>
          <li>An automation key cannot authorize itself.</li>
        </ol>
        <p>
          The full mapping — invariant, the code that enforces it, the test that proves it — is in{' '}
          <a href={`${REPO}/blob/main/docs/SUI_SECURITY_MODEL.md`} target="_blank" rel="noreferrer">
            the security model
          </a>
          .
        </p>
        <H>What is absent by construction</H>
        <p>
          Reentrancy is not defended against; it cannot happen. Move has no dynamic dispatch into a
          caller, and the only outgoing value movement is a coin split after the proposal’s status
          has already been written. The ordering is kept anyway, because it costs nothing and
          survives a refactor.
        </p>
      </>
    ),
  },
  {
    slug: 'limitations',
    title: 'Limitations',
    group: 'Assurance',
    body: () => (
      <>
        <p className="doc-lead">
          Design positions, not oversights. State these to anyone evaluating the system.
        </p>
        <ul>
          <li>
            <b>No independent audit.</b> Do not put real value behind Skur until one is complete.
          </li>
          <li>
            <b>Anchored windows, not sliding ones.</b> A day bucket anchors on its first charge, so
            up to two days’ allowance can leave across a boundary.
          </li>
          <li>
            <b>Exposure is per asset.</b> No portfolio-wide number without a price oracle, and a
            wrong portfolio number would be worse than an honest per-asset one.
          </li>
          <li>
            <b>The breaker latches; it does not refund.</b> Everything that executed before the trip
            stays paid. What it buys is that the trip happens instead of the payment that would have
            crossed the line.
          </li>
          <li>
            <b>The envelope basis is the balance when the window opened.</b> A large deposit
            mid-window does not raise that window’s allowance.
          </li>
          <li>
            <b>Single-guardian vaults.</b> One key both freezes and, with owners, unfreezes. The
            larger templates ship with two.
          </li>
          <li>
            <b>A shared object serializes.</b> Every write to a vault goes through consensus on that
            object, so one vault has a throughput ceiling. For a treasury doing thousands of
            payments an hour the answer is several vaults, not a pretence otherwise.
          </li>
          <li>
            <b>No arbitrary contract calls in V1.</b> Only coin transfers exist, so “unlimited
            approval” and “malicious contract” are excluded by construction rather than analysed —
            which is also why decoding arbitrary calls is on the roadmap rather than claimed.
          </li>
          <li>
            <b>Paying an address does not promote it.</b> Only governance changes trust, so payments
            to a never-registered address are escalated every time.
          </li>
        </ul>
      </>
    ),
  },
];

const GROUPS = ['Start', 'Model', 'Reference', 'Assurance'];

export const DOC_SLUGS = DOCS.map((d) => d.slug);

export function DocsView({ slug }: { slug: DocSlug }) {
  const doc = DOCS.find((d) => d.slug === slug) ?? DOCS[0];
  const i = DOCS.indexOf(doc);
  const prev = i > 0 ? DOCS[i - 1] : null;
  const next = i < DOCS.length - 1 ? DOCS[i + 1] : null;
  return (
    <MarketingShell page="docs" hideCta>
      <div className="docs">
        <aside className="docs-nav">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="docs-group">{g}</div>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <Link
                  key={d.slug}
                  href={d.slug === 'introduction' ? '/docs' : `/docs/${d.slug}`}
                  style={{ display: 'block' }}
                >
                  <button className={d.slug === doc.slug ? 'on' : ''}>{d.title}</button>
                </Link>
              ))}
            </div>
          ))}
        </aside>
        <article className="docs-body">
          <div className="docs-crumb">Docs / {doc.group}</div>
          <h1>{doc.title}</h1>
          {doc.body()}
          <nav className="docs-paging">
            {prev ? (
              <Link href={prev.slug === 'introduction' ? '/docs' : `/docs/${prev.slug}`}>
                <button>← {prev.title}</button>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`}>
                <button>{next.title} →</button>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </MarketingShell>
  );
}
