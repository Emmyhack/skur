# Moving from EVM to Sui

What came across, what changed shape because Sui is not an EVM chain, and what the old build is
still here for.

## Why move at all

The EVM build worked and was deployed to the Ark Constellation devnet. The reason to move is not
that the code was wrong; it is that the controls Skur exists to provide — approvals that scale with
risk, cumulative outflow accounting, a circuit breaker, a guardian plane — have no onchain
competitor on Sui, while on an EVM chain they sit next to a mature module ecosystem around Safe.
Sui is where this is infrastructure rather than a feature.

Four things about Sui also make the design better rather than merely portable:

- **A vault is one shared object.** The policy, the roster, the recipients and the proposals are
  fields on it, so "what are the rules right now" is a single read. On the EVM they were storage
  slots across a proxy, and the interface had to reconstruct them.
- **Programmable transaction blocks** let creation be atomic without a factory. `begin` hands back
  a value with no abilities, so the same transaction must configure the assets and call `finish`.
  There is no half-configured vault, and no EIP-1167 clone to deploy and verify.
- **`sui::clock`** gives millisecond time in the transaction. Timelocks are durations, not block
  arithmetic.
- **Typed coins.** The treasury is keyed by `TypeName`, so one vault holds any coin type with its
  own limits, day and envelope — no token allowlist to maintain, and no `SafeERC20` dance around
  tokens that lie about their return values.

## What carried over unchanged

The security model. Every control in the EVM build is in the Move build, with the same semantics:

- the four treasury roles and the exclusive guardian role;
- the three tiers, the six trust levels, the three security modes, the reason bitmask;
- all seventeen policy fields and every validation rule, including the awkward ones — the
  proposal lifetime that must clear the longest delay by an hour, the hard block that cannot sit
  below the critical exposure threshold;
- the loosening comparison, including the cases where a number going down is a weakening;
- anchored 24-hour buckets and the loss envelope;
- recipient activation delay, pinned-then-tighten-only requirements, live approval recount;
- guardian veto, guardian recovery with an owner cancel;
- the seven policy templates and the attack simulator.

The TypeScript engines came across as the same algorithms: `risk`, `policy`, `templates`,
`maxLoss`, `posture`, `simulator`, `format`. They now live in [`sdk/src/engine/`](../sdk/src/engine/)
as one copy shared by every interface, instead of in `web/src/lib` with the mobile app reaching
into it through a path alias.

## What changed shape

| EVM | Sui | Why |
|---|---|---|
| `SkurFactory` + EIP-1167 clones | `vault::begin` → `setup_*` → `finish` in one PTB | A shared object does not need a proxy, and a hot potato makes the configuration atomic |
| `address` asset identifiers with an allowlist | `TypeName` keys into a `Bag` of `Balance<T>` | The type system is the allowlist |
| `mapping` + arrays for members, recipients, proposals | `Table` and dynamic fields | Reads are per entry rather than per array scan, which is why the SDK lists names and fetches values |
| Durations in seconds | Durations in milliseconds | `sui::clock` reports milliseconds; converting at every comparison is how you get an off-by-1000 |
| `revert` on a tripped breaker, with the mode write lost | `execute_transfer` returns without aborting, so the Lockdown write commits | A latch that reverts with the transaction is not a latch. This is the one behavioural change, and it is a fix |
| `nonReentrant` | Nothing | Move has no dynamic dispatch into a caller; reentrancy is absent by construction |
| `SafeERC20` | `balance::split` | A `Balance<T>` cannot lie about a transfer |
| Events read with `eth_getLogs`, in 9,000-block windows | `listEvents` over gRPC with ledger cursors | No block-range limit to work around; a cursor resumes exactly |
| wagmi + viem, Vite | `@mysten/dapp-kit-react` 2.x, Next.js | `@mysten/dapp-kit` 1.x is deprecated for being JSON-RPC only |
| Nothing | A `PROPOSER` role | The agent case: software that can request a payment and provably cannot take one |
| Nothing | A Node/PostgreSQL indexer and notification service | The EVM interface read the chain directly for everything, which is honest but slow past a few hundred proposals |

### The one semantic change worth arguing about

On the EVM, a transfer that would cross the loss envelope reverted. Reverting undid the state
change that put the vault into Lockdown, so the breaker tripped and the vault stayed open — an
attacker could keep trying, and every attempt cost them only gas.

In Move the function returns instead of aborting: the proposal is marked `BLOCKED`, the vault is set
to Lockdown, a `BreakerTripped` event is emitted, and the transaction **succeeds** so all of that
persists. The money does not move. This is tested by
`crossing_the_loss_envelope_freezes_the_vault_instead_of_paying`, which asserts all three: the
status, the unchanged balance, and the Lockdown.

## What the old build is still here for

[`contracts/`](../contracts/), [`web/`](../web/) and [`mobile/`](../mobile/) are the EVM build. They
are kept because:

- the deployed devnet vault and its verified sources are the only live thing to point an evaluator
  at until the Sui package is published and audited;
- `web/src/lib` is the reference the Move modules were ported against, and the EVM test suite is a
  second opinion on the engines;
- two pull requests against them are still open.

They are not the direction. New work goes into [`sui/`](../sui/), [`sdk/`](../sdk/),
[`app/`](../app/) and [`server/`](../server/). The root `package.json` keeps the old scripts under
`legacy:` so nothing silently runs the wrong suite.

When the Sui package is audited and deployed, the EVM build should be removed rather than
maintained in parallel. Two implementations of a security model is one more than anyone can keep
honest.
