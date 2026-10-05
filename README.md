# Skur

**A programmable authorization and treasury security layer for Sui organizations.**

> A valid signature proves authorization. It does not prove that a payment is safe.

Every large onchain treasury loss of the last few years happened with valid signatures. The keys
were real, the threshold was met, the contract did what it was told. Nothing between the signature
and the money asked the second question:

> Given the amount, the destination, what has already left today and what this organization knows
> right now, *should* this payment settle?

Skur answers that question in Move, in a shared object anyone can read. It is not a wallet, and it
is not a nicer multisig — Sui has signature aggregation in the protocol already. It is the layer a
treasury sits behind.

## What the vault enforces

| Control | What it does |
|---|---|
| **Risk-tiered authorization** | Five signals — amount against the asset's limits, share of holdings, recipient standing, the day's outflow, the vault's mode — each able to raise the tier and none able to lower it. The tier sets the approvals, the guardian sign-off and the wait. |
| **Recipient trust** | An address the vault has never paid is escalated every time. A newly registered one serves an activation delay before it can be paid at all. |
| **Velocity limits** | Per-transaction and 24-hour caps, counted cumulatively. Crossing half the day's allowance escalates everything after it, so splitting a drain meets a higher bar partway through rather than never. |
| **Loss-envelope circuit breaker** | A share of the balance that may leave per window, measured against the balance when the window *opened*. The payment that would cross it is not made; the vault latches into Lockdown instead. |
| **Guardians** | A role the contract refuses to combine with any treasury role. It can freeze, veto, block a recipient and start a recovery. It can never propose, approve or execute a payment. |
| **Policy firewall** | Any change that gives up a control — including the ones that look like tightening, such as zeroing a threshold to disable it — waits out a delay, can be vetoed by any guardian, and cannot be proposed in Lockdown. |
| **An agent role** | `PROPOSER` can open a payment and nothing else. A compromised automation key produces a queue nobody approved, not a withdrawal. |

Details, with the test that proves each invariant, in
[docs/SUI_SECURITY_MODEL.md](docs/SUI_SECURITY_MODEL.md).

## Repository layout

| Path | What it is |
|---|---|
| [sui/](sui/) | The Move package: `types`, `policy`, `risk`, `vault`, and the test suites named after the attacks they defend against |
| [sdk/](sdk/) | TypeScript SDK on `@mysten/sui` v2 — reads, PTB builders, event decoding, and the chain-agnostic engines (risk, policy rules, templates, maximum loss, posture, attack simulator) |
| [app/](app/) | The interface: Next.js, React, `@mysten/dapp-kit-react` |
| [server/](server/) | Node and PostgreSQL: the event indexer, the notification service and the advisory API |
| [docs/SUI_SECURITY_MODEL.md](docs/SUI_SECURITY_MODEL.md) | Roles, lifecycle, the sixteen invariants, the threat map and the known limitations |
| [docs/SUI_LANDSCAPE.md](docs/SUI_LANDSCAPE.md) | What exists on Sui today and what it does not do |
| [docs/SUI_POSITIONING.md](docs/SUI_POSITIONING.md) | The positioning and funding narrative |
| [docs/MIGRATION_EVM_TO_SUI.md](docs/MIGRATION_EVM_TO_SUI.md) | What moved, what changed shape, and why |
| [contracts/](contracts/), [web/](web/), [mobile/](mobile/) | The previous EVM build, kept for reference. See the migration note |

## Transport: gRPC and GraphQL, never JSON-RPC

JSON-RPC was switched off on Sui Foundation mainnet full nodes in the week of 27 July 2026, with
full decommissioning — code removal included — scheduled for mid-October 2026.

Nothing here depends on it, directly or transitively. That is why the interface uses
`@mysten/dapp-kit-react` 2.x and not `@mysten/dapp-kit` 1.x, which is deprecated precisely because
it is JSON-RPC only. The SDK's read layer targets the transport-agnostic Core API, so the same code
runs over gRPC today and over anything implementing that contract later.

## Verifying everything at once

```bash
npm run verify
```

Runs what CI runs, job for job: the Move build (which must be warning-free) and its 75 tests, the
SDK's typecheck, build and tests, the backend's typecheck, tests and migrations against a real
Postgres, and the interface's typecheck and build. It skips rather than fails the steps whose
tooling is absent — a missing Postgres is not a broken migration — and exits non-zero if anything
genuinely breaks.

`npm run verify -- --all` adds the previous EVM build's suites when Foundry is installed.

## Quick start

```bash
# the Move core
cd sui
sui move build
sui move test                      # 75 tests: the engine vectors and the end-to-end suite
scripts/verify-local.sh            # publish to a throwaway local network and drive it

# the SDK
cd ../sdk
npm install && npm run build
npm test                           # the same vectors as the Move suite

# the backend
cd ../server
cp .env.example .env               # set DATABASE_URL and SKUR_PACKAGE_ID
createdb skur && npm install && npm run migrate
npm run dev                        # the indexer and the read API together

# the interface
cd ../app
npm install
npm run dev                        # http://localhost:3000
```

The Sui CLI is the one prerequisite that is not an npm install: get it from
[the releases page](https://github.com/MystenLabs/sui/releases) or with
`cargo install --locked --git https://github.com/MystenLabs/sui.git sui`.

## Deploying

```bash
cd sui
scripts/publish.sh testnet         # builds, tests, publishes, writes deployments/testnet.json

cd ../sdk
SUI_PRIVATE_KEY=suiprivkey1... SKUR_NETWORK=testnet SKUR_PACKAGE_ID=0x... \
  node --experimental-strip-types scripts/seed.ts
```

Then verify the whole stack against the live chain:

```bash
cd sdk
SUI_PRIVATE_KEY=suiprivkey1... SKUR_NETWORK=testnet SKUR_PACKAGE_ID=0x... npm run e2e
```

`npm run e2e` is the test the unit suites cannot be: it creates a vault, funds it, previews a
payment, opens it, approves it, proves the activation delay holds, executes it, and checks that
every event decodes back into the shape the indexer projects. One wrong BCS field offset fails it
loudly where a unit test would pass.

`sui/deployments/<network>.json` is the only place a package address is configured. Nothing in the
app, the SDK or the backend hardcodes one.

## How a payment goes out

1. **Opened.** The vault classifies it routine, high risk or critical from the amount, the share of
   holdings, the recipient's standing, the day's outflow and the security mode, and pins the
   approvals, the guardian confirmations and the delay.
2. **Approved, or turned down.** Approvers approve; guardians confirm when the tier demands it.
   Rejecting takes as many signers as approving, so a bad proposal can be cleared rather than left
   to expire — and one signer cannot block the queue. A guardian can veto any critical payment, any
   weakening of the vault, any recovery and any relaxation.
3. **Executed.** The vault re-checks everything against live state: the approval set is recounted
   against the current roster, the payment is reclassified and the *stricter* of the pinned and
   live requirements applies, the recipient's standing and activation are re-read, and the caps and
   the hard block are re-applied. The loss envelope is checked last; a payment that would cross it
   is refused and the vault latches into Lockdown.
4. **Governance** follows the same path with owner approvals. Anything that gives up a control waits
   out the policy-change delay, is vetoable, and is refused in Lockdown.

## Status

Built and under test: the Move core with all seven proposal kinds, the SDK over gRPC and GraphQL,
the indexer and notification service on PostgreSQL, the interface, and seven starting policies —
startup, operating team, protocol/DAO, fund, payments company, nonprofit, family office.

Not done, and not claimed: **no independent audit**, no mainnet deployment, no pilot. Do not put
real value behind Skur until an audit is complete.
