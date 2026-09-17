import { useEffect } from "react";
import { MarketingShell } from "../components/MarketingShell";
import { DEPLOYMENTS, ARK_DEVNET_EXPLORER, ARK_DEVNET_RPC } from "../config/chain";
import { POLICY_GROUPS } from "../lib/policyFields";
import { TEMPLATES } from "../lib/templates";
import { fmtDuration } from "../lib/format";

export type DocSlug =
  | "introduction" | "quick-start" | "roles" | "risk-tiers" | "policy" | "recipients"
  | "limits" | "modes" | "changes" | "recovery" | "mobile" | "contracts" | "invariants" | "limitations";

type Doc = { slug: DocSlug; title: string; group: string; body: () => React.ReactNode };

const H = ({ children }: { children: React.ReactNode }) => <h3 id={String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-")}>{children}</h3>;
const Note = ({ children }: { children: React.ReactNode }) => <div className="doc-note">{children}</div>;

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="doc-table">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const DOCS: Doc[] = [
  {
    slug: "introduction", title: "Introduction", group: "Start",
    body: () => (
      <>
        <p className="doc-lead">Skur is a self-custodial treasury vault whose security requirements rise and fall with the risk of each transaction.</p>
        <p>A multisignature wallet asks one question: did enough people sign? Skur asks a second one: should this transaction be allowed right now? Between a valid approval and the money sit amount tiers, recipient trust, velocity caps, a loss envelope, guardian veto and a firewall around policy changes. Every one is enforced by the vault contract, not by a server.</p>
        <H>What Skur does not claim</H>
        <p>Skur does not make signer compromise harmless. It limits and delays the damage when authorised credentials are misused. A stolen key alone cannot reach a tier's threshold unless you set that tier to one, and even then it is bounded by the per-transaction cap, the daily cap and the loss envelope.</p>
        <Note>Skur V1 runs on the Ark Constellation devnet, chain 9000. It has not been audited. Do not put real value behind it until an independent audit is complete.</Note>
      </>
    ),
  },
  {
    slug: "quick-start", title: "Quick start", group: "Start",
    body: () => (
      <>
        <p className="doc-lead">Three ways in, none of which require a deployment of your own.</p>
        <H>Read the demo vault</H>
        <p>Open the app and choose the demo vault. No wallet is needed to read a vault: balances, the queue, the policy and the security posture all come from the chain.</p>
        <H>Create your own</H>
        <ol>
          <li>Connect a wallet on the Ark devnet. The app will offer to switch networks if you are on another chain.</li>
          <li>Name the vault and pick the template closest to your organisation. Every value can be changed later through governance.</li>
          <li>List the members and their roles. Owners govern, approvers confirm payments, executors execute, guardians hold the brake.</li>
          <li>Review the policy the vault will enforce from its first block, then sign once.</li>
        </ol>
        <H>Send a payment</H>
        <p>Enter the recipient, asset and amount. Before the wallet opens, the vault itself classifies the payment: the tier, the approvals it needs, whether a guardian must sign, how long it waits and why. Approvals are recounted against live membership at execution, and the caps are checked again.</p>
      </>
    ),
  },
  {
    slug: "roles", title: "Roles", group: "Model",
    body: () => (
      <>
        <p className="doc-lead">Four roles, held as a bitmask. A member can hold several treasury roles; a guardian can hold none.</p>
        <Table head={["Role", "Can", "Cannot"]} rows={[
          ["Owner", "Propose and confirm governance: policy, limits, members, recipient trust, lowering the mode", "Move funds without meeting the transfer policy"],
          ["Approver", "Confirm transfers", "Execute or govern"],
          ["Executor", "Execute a transfer once every condition holds", "Approve it"],
          ["Guardian", "Freeze the vault, veto, confirm critical transfers, propose recovery", "Propose, approve or execute a transfer, or hold any treasury role"],
        ]} />
        <H>Why guardians are exclusive</H>
        <p>The contract refuses to give a guardian a treasury role, and refuses to give a treasury member the guardian role. That makes guardians a second control plane an attacker must breach separately, and one they cannot profit from: there is no withdrawal path from guardian authority.</p>
      </>
    ),
  },
  {
    slug: "risk-tiers", title: "Risk tiers", group: "Model",
    body: () => (
      <>
        <p className="doc-lead">Every transfer is scored when it is proposed. The score sets the requirements, and the requirements are pinned to the proposal.</p>
        <H>What the vault reads</H>
        <Table head={["Signal", "Effect"]} rows={[
          ["Amount against the asset's routine and high thresholds", "Above routine is High, above high is Critical"],
          ["Share of the vault's holdings of that asset", "Above the high or critical exposure percentage escalates the tier"],
          ["Recipient trust", "Never paid, still in its activation delay, or restricted escalates the tier"],
          ["Today's outflow", "Past half the daily cap escalates to High"],
          ["Security mode", "Elevated escalates every payment one tier"],
        ]} />
        <H>What the tier decides</H>
        <p>The number of approvals, whether a guardian must confirm, and how long the proposal waits before it can execute. A proposal carries its requirements from the moment it is created, so a later policy change cannot lower the bar for something already in the queue.</p>
        <Note>The same rules run in the interface only to preview. The contract classifies independently at proposal time and checks the caps again at execution.</Note>
      </>
    ),
  },
  {
    slug: "policy", title: "Policy reference", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">Every control a vault enforces, and the rules a policy must satisfy to be valid.</p>
        {POLICY_GROUPS.map((g) => (
          <div key={g.title}>
            <H>{g.title}</H>
            <p>{g.sub}</p>
            <Table head={["Field", "Unit", "Meaning"]} rows={g.fields.map((f) => [f.label, f.unit === "bps" ? "percent" : f.unit === "hours" ? "duration" : f.unit === "bool" ? "on or off" : "count", f.hint || "—"])} />
          </div>
        ))}
        <H>Validation</H>
        <p>A policy the contract will not accept:</p>
        <ul>
          <li>Routine approvals below one, or a tier requiring fewer approvals than the tier beneath it.</li>
          <li>A governance threshold of zero, or above the number of owners.</li>
          <li>A guardian requirement for critical transfers with a guardian threshold of zero.</li>
          <li>A critical delay shorter than the high delay.</li>
          <li>Exposure thresholds above 100%, out of order, or a hard block below the critical threshold.</li>
          <li>An envelope window under one hour, or a proposal lifetime that does not exceed the longest delay by at least one hour.</li>
        </ul>
        <H>Templates</H>
        <Table head={["Template", "For", "Critical delay", "New recipients", "Envelope"]} rows={TEMPLATES.map((t) => [t.name, t.tagline, fmtDuration(t.policy.delayCritical), fmtDuration(t.policy.recipientActivationDelay), `${t.policy.envelopeBps / 100}% per ${fmtDuration(t.policy.envelopeWindow)}`])} />
      </>
    ),
  },
  {
    slug: "recipients", title: "Recipients and trust", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">A recipient is a security object, not a string in a form.</p>
        <Table head={["State", "Meaning"]} rows={[
          ["Unknown", "Never seen. Paying it registers it as New and escalates the tier."],
          ["New", "Registered and serving its activation delay. It cannot be paid before the delay elapses."],
          ["Verified", "Normal policy applies."],
          ["Trusted", "Normal policy applies; reserved for counterparties you have paid repeatedly."],
          ["Restricted", "Always classified Critical."],
          ["Blocked", "Refused outright."],
        ]} />
        <p>Registering a supplier early starts its activation clock, so its first real payment does not have to wait. Raising a recipient's trust loosens security: it waits out the policy-change delay and any guardian can veto it. Restricting or blocking takes effect as soon as owners approve.</p>
      </>
    ),
  },
  {
    slug: "limits", title: "Limits and the circuit breaker", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">Caps are per asset and cumulative, so splitting a payment changes nothing.</p>
        <Table head={["Limit", "Checked", "On breach"]} rows={[
          ["Routine maximum", "At proposal", "The payment is scored High"],
          ["High maximum", "At proposal", "The payment is scored Critical"],
          ["Per-transaction cap", "At proposal and execution", "Refused"],
          ["Daily cap", "At execution, against a 24-hour bucket", "Refused"],
          ["Loss envelope", "At execution, against its own window", "Not paid; the vault enters Lockdown"],
        ]} />
        <H>The breaker latches</H>
        <p>The transfer that would cross the envelope is not paid. Instead the vault moves to Lockdown, where outgoing execution stops and only tightening changes, deposits, recovery and guardian actions still work. Leaving Lockdown needs owners and guardians together, and waits out the policy-change delay.</p>
        <Note>Buckets are anchored to a fixed window rather than a rolling one. An attacker who waits for a boundary gets two windows' worth in quick succession; the envelope is the backstop for that case.</Note>
      </>
    ),
  },
  {
    slug: "modes", title: "Security modes", group: "Reference",
    body: () => (
      <>
        <Table head={["Mode", "Effect", "Entered by", "Left by"]} rows={[
          ["Normal", "The policy as configured", "—", "—"],
          ["Elevated", "Every payment is scored one tier higher; per-transaction and daily caps are halved", "Any owner or guardian, instantly, with a reason recorded onchain", "Owners and guardians together"],
          ["Lockdown", "Outgoing execution and security-reducing changes are blocked", "Any owner or guardian, or the circuit breaker", "Owners and guardians together, after the policy-change delay"],
        ]} />
        <p>Raising the mode is instant and unilateral by design: in an incident, the cost of a false alarm is far lower than the cost of a delay. Lowering it is governance.</p>
      </>
    ),
  },
  {
    slug: "changes", title: "Changing the policy", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">Changing the rules is as dangerous as moving the money, so it goes through its own firewall.</p>
        <p>Every proposed change is classified. If it loosens any control, it is security-reducing and:</p>
        <ul>
          <li>waits out the policy-change delay before it can execute,</li>
          <li>can be vetoed by any single guardian at any point,</li>
          <li>cannot be proposed at all while the vault is in Lockdown.</li>
        </ul>
        <p>A change that tightens or keeps every control applies as soon as owners approve. Loosening includes fewer approvals, shorter delays, higher caps, a wider envelope, a higher exposure threshold, raising a recipient's trust, approving a new asset, adding authority to a member and weakening the guardian layer.</p>
        <Note>Proposals in flight keep the requirements pinned when they were created, so a loosening that activates later cannot lower the bar for something already queued.</Note>
      </>
    ),
  },
  {
    slug: "recovery", title: "Recovery", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">Replacing a lost or compromised signer without giving anyone a backdoor.</p>
        <ol>
          <li>Guardians propose replacing an address with a new one holding the same roles.</li>
          <li>The proposal waits out the recovery delay. Any owner can cancel it during that window.</li>
          <li>On execution the roles move across. The policy is untouched, and the vault moves to Elevated.</li>
        </ol>
        <p>Recovery cannot change thresholds, delays, caps or anyone else's roles. It is the narrowest possible operation: one address for another.</p>
      </>
    ),
  },
  {
    slug: "mobile", title: "The phone app", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">iOS and Android, sharing this site's risk engine, policy rules and contract reads.</p>
        <p>There is no wallet connection. A signer key is created on the phone or imported, kept in the device keychain, and used after a Face ID or Touch ID prompt. Give that address a role in a vault and it signs; without a role the app is a reader.</p>
        <p>Everything the desktop does is there: balances, the queue, the confirm screen with the vault's own review, the policy editor, members, the address book, the attack simulator, security modes and recovery. Notifications are local: when the app reads the vault and finds a proposal that newly needs you, it raises one. Nothing is sent to a server.</p>
        <p>It is not on the app stores. Build it from the repository with Expo.</p>
      </>
    ),
  },
  {
    slug: "contracts", title: "Contracts and addresses", group: "Reference",
    body: () => (
      <>
        <p className="doc-lead">Skur V1 on the Ark Constellation devnet, chain 9000. Every address below is verified on the explorer.</p>
        <Table head={["Contract", "Address"]} rows={[
          ["Factory", <a key="f" href={`${ARK_DEVNET_EXPLORER}/address/${DEPLOYMENTS.factory}`} target="_blank" rel="noreferrer"><code>{DEPLOYMENTS.factory}</code></a>],
          ["Vault implementation", <a key="i" href={`${ARK_DEVNET_EXPLORER}/address/${DEPLOYMENTS.vaultImplementation}`} target="_blank" rel="noreferrer"><code>{DEPLOYMENTS.vaultImplementation}</code></a>],
          ["Demo vault", <a key="d" href={`${ARK_DEVNET_EXPLORER}/address/${DEPLOYMENTS.demoVault}`} target="_blank" rel="noreferrer"><code>{DEPLOYMENTS.demoVault}</code></a>],
          ["Skur Test USD", <a key="u" href={`${ARK_DEVNET_EXPLORER}/address/${DEPLOYMENTS.testUsd}`} target="_blank" rel="noreferrer"><code>{DEPLOYMENTS.testUsd}</code></a>],
        ]} />
        <H>Endpoints</H>
        <Table head={["What", "Where"]} rows={[["RPC", <code key="r">{ARK_DEVNET_RPC}</code>], ["Explorer", <a key="e" href={ARK_DEVNET_EXPLORER} target="_blank" rel="noreferrer">{ARK_DEVNET_EXPLORER.replace("https://", "")}</a>]]} />
        <p>Each vault is a minimal proxy over one verified implementation. The factory keeps no authority over the vaults it creates, and a vault has no admin and no upgrade path. Moving to a new version means creating a new vault and transferring funds under the old vault's own policy.</p>
      </>
    ),
  },
  {
    slug: "invariants", title: "Invariants and testing", group: "Assurance",
    body: () => (
      <>
        <p className="doc-lead">Twelve properties, each with a test.</p>
        <ol className="doc-inv">
          {["No proposal executes before every active condition is met", "A guardian cannot move treasury assets through guardian authority alone", "Lockdown blocks ordinary outgoing execution", "Security-reducing policy changes never take effect immediately", "Cumulative outflow accounting cannot be bypassed by splitting", "A proposal cannot execute twice", "Removed signers cannot approve new actions", "Approvals cannot be duplicated or replayed", "New recipients cannot skip their activation delay", "Recovery cannot quietly weaken the policy", "Native and ERC-20 accounting reconciles", "External calls cannot re-enter an unsafe state"].map((t) => <li key={t}>{t}</li>)}
        </ol>
        <p>The suite is 95 tests: a unit test per control, fuzzed monotonicity properties, and a stateful handler driving random actors against the vault. Static analysis reports nothing above informational, sources are verified on the explorer, and the repository builds to byte-identical runtime bytecode.</p>
      </>
    ),
  },
  {
    slug: "limitations", title: "Known limitations", group: "Assurance",
    body: () => (
      <>
        <p className="doc-lead">What Skur V1 does not do, stated plainly.</p>
        <ul>
          <li><b>No audit.</b> The contracts have not been reviewed by an independent firm.</li>
          <li><b>No price oracle.</b> Exposure is measured per asset, as a share of that asset's holdings, not of the treasury's value.</li>
          <li><b>Anchored windows.</b> Velocity and envelope buckets are anchored rather than rolling, so a boundary allows two windows in quick succession.</li>
          <li><b>The breaker latches.</b> Crossing the envelope stops the payment and freezes the vault; it does not reverse anything already paid.</li>
          <li><b>Single-guardian vaults.</b> Permitted, and a single point of failure for veto and recovery. Use more than one.</li>
          <li><b>Devnet only.</b> Endpoints and deployments target the Ark Constellation devnet.</li>
        </ul>
      </>
    ),
  },
];

const GROUPS = ["Start", "Model", "Reference", "Assurance"];

export function Docs({ slug, onLaunch, onNavigate }: { slug: DocSlug; onLaunch: () => void; onNavigate: (s: DocSlug) => void }) {
  const doc = DOCS.find((d) => d.slug === slug) ?? DOCS[0];
  const i = DOCS.indexOf(doc);
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  return (
    <MarketingShell page="docs" onLaunch={onLaunch} hideCta>
      <div className="docs">
        <aside className="docs-nav">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="docs-group">{g}</div>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <button key={d.slug} className={d.slug === slug ? "on" : ""} onClick={() => onNavigate(d.slug)}>{d.title}</button>
              ))}
            </div>
          ))}
        </aside>
        <article className="docs-body">
          <div className="docs-crumb">Docs / {doc.group}</div>
          <h1>{doc.title}</h1>
          {doc.body()}
          <nav className="docs-paging">
            {i > 0 ? <button onClick={() => onNavigate(DOCS[i - 1].slug)}>← {DOCS[i - 1].title}</button> : <span />}
            {i < DOCS.length - 1 ? <button onClick={() => onNavigate(DOCS[i + 1].slug)}>{DOCS[i + 1].title} →</button> : <span />}
          </nav>
        </article>
      </div>
    </MarketingShell>
  );
}

export const DOC_SLUGS = DOCS.map((d) => d.slug);
