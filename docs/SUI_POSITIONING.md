# Skur: a programmable authorization and treasury security layer for Sui

Positioning and funding narrative. Written for grant reviewers, RFP committees and prospective
investors — people who will read one page before deciding whether to read the code.

---

## The one sentence

**Skur decides how much authorization a payment needs, and whether it may settle right now, from
the amount, the destination, the recent outflow and the vault's own security posture — enforced in
Move, in a shared object anyone can read.**

It is not a wallet. It is the authorization layer a treasury sits behind.

## Why this is not a multisig pitch

A multisig answers one question: *did k of n sign?*

That question is necessary and insufficient. Every large onchain treasury loss of the last three
years happened with **valid signatures**. The keys were real, the threshold was met, the contract
did exactly what it was told. The failure was never the signature check. It was that nothing
between the signature and the money asked a second question:

> Given the amount, the destination, what has already left today and what the organization knows
> right now, *should* this payment settle?

Sui already has signature aggregation in the protocol — native multisig, up to ten keys, mixed
schemes, free. Building a nicer interface over it is a design project, not an infrastructure one.
The layer that is genuinely missing is the one that answers the second question.

## What exists on Sui today, and what it does not do

A detailed pass is in [`SUI_LANDSCAPE.md`](./SUI_LANDSCAPE.md). The short version:

| | Native multisig | account.tech | Maven (MSafe) | MPCVault | **Skur** |
|---|---|---|---|---|---|
| k-of-n threshold | yes | yes | yes | yes | yes |
| Onchain proposal object | no | yes | yes | no | yes |
| Approvals that scale with amount | no | no | no | offchain | **yes** |
| Approvals that scale with share of treasury | no | no | no | no | **yes** |
| Cumulative, split-proof outflow accounting | no | no | no | unclear | **yes** |
| Recipient trust and a new-recipient delay | no | no | no | allowlist | **yes** |
| Risk-tiered timelocks | no | code upgrades only | no | no | **yes** |
| Loss-envelope circuit breaker | no | no | no | no | **yes** |
| Guardian role with no spend path | no | no | no | no | **yes** |
| Tightening-only policy changes with a veto | no | no | no | no | **yes** |
| Rules enforced in Move, readable onchain | n/a | yes | yes | **no** | **yes** |

**account.tech** is the serious engineering in this space and the right benchmark. It is an
*extensibility* framework: an intent-based smart account where only approved packages may act. Its
one time-based control is an upgrade timelock, which protects code rather than money. It makes a
treasury programmable; it does not make a treasury defended. These are different axes, and we would
rather be a policy module it can consult than a competing account standard.

**MPCVault** has real approval workflows and audit logs across chains — and they live in a
company's backend. Ours live in a shared object. That is the whole difference, and it is the
sentence we are willing to be judged on.

## What the Move core actually enforces

Six controls stand between a valid approval and the money. All of them are in
[`sui/sources/`](../sui/sources/), and every one has a test named after the attack it defends
against in [`sui/tests/`](../sui/tests/).

1. **Risk-tiered authorization.** Five independent signals — the absolute amount against the
   asset's own limits, the payment's share of holdings, the recipient's standing, the day's
   outflow so far, and the vault's security mode — each able to raise the tier and none able to
   lower it. The tier sets the approvals, the guardian sign-off and the wait.

2. **Recipient trust with an activation delay.** An address the vault has never paid is scored
   higher, every time. A newly registered one serves a delay before it can be paid at all. Raising
   an address's trust is a governance action with a timelock; a guardian can restrict or block one
   instantly, alone.

3. **Cumulative velocity accounting.** Per-transaction and per-day caps, counted against what has
   already left. Crossing half the day's allowance escalates every further payment, so a drain
   split into twenty pieces meets a higher bar partway through instead of never.

4. **A loss-envelope circuit breaker.** A share of the balance that may leave per window. The
   payment that would cross it **is not made**: the vault latches into Lockdown and the transaction
   still succeeds, because a latch that reverts with the transaction is not a latch. The envelope
   is measured against the balance when the window *opened*, so a drain cannot shrink its own
   denominator.

5. **A guardian role with no path to the money.** The contract refuses to give a guardian any
   treasury role, and refuses to give a treasury member the guardian role. A guardian can freeze,
   veto, block a recipient and start a recovery. It can never propose, approve or execute a
   payment. It is the second control plane an attacker has to breach and the one they cannot profit
   from.

6. **A policy-change firewall.** Any change that gives up a control is detected by comparing the
   old and new policy field by field — including the cases that look like tightening and are not,
   such as setting a threshold to zero to disable it, or extending a proposal's lifetime. A
   weakening waits out the policy-change delay, can be vetoed by any guardian, and cannot be
   proposed at all while the vault is in Lockdown.

Plus the things that make the above hold under adversarial conditions:

- **Requirements are pinned, then tighten-only.** At execution the payment is reclassified and the
  *stricter* of the pinned and live requirements applies. Tightening the policy affects payments
  already in flight; loosening it cannot rescue one.
- **Approvals are recounted against the live roster.** A signer removed after approving stops
  counting. The tally is never trusted as a number frozen at approval time.
- **Deposits are never gated.** Even in Lockdown, even from a stranger. The controls exist to
  govern money leaving; refusing money arriving would only strand it.

## The agent case, which is where this is going

An organization increasingly wants software to *request* payments — an invoice processor, a
rebalancer, an LLM agent reading a vendor inbox. Nobody sensibly wants software to *authorize*
them.

Skur has a `PROPOSER` role that can open a proposal and do nothing else. It cannot approve, cannot
confirm, cannot execute, and cannot be a guardian. A fully compromised agent key produces a queue
of proposals that no human approved. That is the difference between an automation incident and a
loss, and no threshold product can express it, because to a threshold every key is the same kind of
key.

## Why Sui, specifically

This is not a port looking for a chain.

- **A vault is a shared object**, not an account with a nonce. Its policy, its roster, its
  recipients and its proposals are fields on one object, so "what are the rules right now" is a
  single read and not an archaeology exercise across storage slots.
- **Programmable transaction blocks** make a hot-potato setup flow possible: creating a vault
  hands back a value with no abilities, so the same transaction must configure the assets and
  finish, and there is no window in which a half-configured vault is reachable.
- **`sui::clock`** gives millisecond time in the transaction, so timelocks are expressed directly
  rather than inferred from block numbers.
- **Typed coins** mean the treasury is keyed by type. One vault holds SUI, stablecoins and any
  other coin, each with its own limits, its own day and its own envelope — without an allowlist of
  token addresses to maintain or get wrong.
- **Move's abilities** make the guardian separation structural rather than conventional.

## V1 scope

Done and under test:

- the Move core: types, policy, risk engine, vault, with the seven proposal kinds and the full
  lifecycle;
- a TypeScript SDK on `@mysten/sui` v2 over **gRPC and GraphQL**;
- a Node/PostgreSQL indexer, notification service and advisory API;
- the chain-agnostic engines — risk classifier, policy rules, templates, maximum-loss calculation,
  posture report and attack simulator — shared by every interface;
- seven starting policies, one per kind of organization: startup, operating team, protocol/DAO,
  fund, payments company, nonprofit, family office.

Explicitly not done, and we will not claim otherwise:

- **no independent audit.** Do not put real value behind Skur until one is complete. Part of what
  we are asking for is the audit.
- **no mainnet deployment.**
- **no oracle.** Exposure is per asset, as a share of that asset's own balance. A vault holding two
  assets does not know their relative value, and we would rather state that than imply a
  portfolio-wide number we cannot compute honestly.
- **anchored, not sliding, windows.** A day bucket anchors on its first spend. It is explained in
  the security model rather than hidden.

## On not building around JSON-RPC

JSON-RPC was switched off on Sui Foundation mainnet full nodes in the week of 27 July 2026, with
full decommissioning — code removal included — scheduled for mid-October 2026.

Nothing in this project depends on it, directly or transitively. That is why the frontend uses
`@mysten/dapp-kit-react` 2.x rather than `@mysten/dapp-kit` 1.x, which is deprecated precisely
because it is JSON-RPC only. The SDK's read layer is written against the transport-agnostic Core
API, so the same code runs over gRPC today and over anything that implements that contract
tomorrow.

## Where the funding goes

| Route | The ask | What it buys |
|---|---|---|
| **Sui Foundation RFP / grant** | Audit and testnet-to-mainnet hardening | An audited, public authorization layer any Sui organization can use, and the only onchain one with velocity and breaker controls |
| **Hackathon** | Proof under a deadline | The agent-proposer demo: an automated agent that can request payments and provably cannot take them |
| **Hydropower accelerator** | Go-to-market with real treasuries | Pilots with three to five Sui organizations; the policy templates come from what they actually need |
| **Academic Research Award** | Formal treatment of the policy algebra | A proof that "tightening-only" is sound: that no sequence of permitted changes reaches a weaker policy without the delay and the veto |
| **Strategic investment** | The product around the core | Mobile, notifications, the organization dashboard, and the integrations |

The audit is the first ask and the honest one. Everything else is easier to fund after it.

## What we want a reviewer to check

Not the pitch. These:

- [`sui/sources/vault.move`](../sui/sources/vault.move) — `execute_transfer` is where every control
  is re-evaluated against live state. If that function is right, the product is right.
- [`sui/sources/policy.move`](../sui/sources/policy.move) — `reductions` is the policy firewall. The
  interesting cases are the ones where a number going *down* is a loosening.
- [`sui/tests/vault_tests.move`](../sui/tests/vault_tests.move) — each test is named after the
  attack. `crossing_the_loss_envelope_freezes_the_vault_instead_of_paying` is the one to read
  first.
- [`docs/SUI_LANDSCAPE.md`](./SUI_LANDSCAPE.md) — the competitive pass, with what the incumbents do
  and do not implement, by their own documentation.
