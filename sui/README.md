# The Skur Move package

Four modules. The first three are pure and the fourth holds the state, which is deliberate: the
rules can be read, tested and argued about without reasoning about the object they act on.

| Module | Lines | What it is |
|---|---|---|
| [`types.move`](sources/types.move) | ~145 | The vocabulary: role bits, risk tiers, trust levels, security modes, proposal kinds, statuses and the reason bitmask. No state, no logic beyond `roles_valid` |
| [`policy.move`](sources/policy.move) | ~340 | The seventeen policy fields, the per-asset limits, every validation rule, and `reductions` — the comparison that decides whether a change weakens the vault |
| [`risk.move`](sources/risk.move) | ~170 | The classifier. Five signals in, a tier, a reason mask and an exposure out. Pure and total |
| [`vault.move`](sources/vault.move) | ~1,700 | The shared object, the proposal lifecycle and every enforcement point |

## Reading order, for a review

1. **`risk::classify`** — five signals, each able to raise the tier and none able to lower it. If
   this is wrong, every number the product shows is wrong.
2. **`policy::reductions`** — the policy firewall. The interesting cases are the ones where a
   number going *down* is a loosening: `threshold_loosens` exists because a threshold of zero means
   "disabled", so moving to zero is the loosest move available and moving away from it can only
   tighten.
3. **`vault::execute_transfer`** — the last gate, and the function that matters most. Everything is
   re-evaluated against live state, the stricter of the pinned and live requirements applies, and
   the circuit breaker is checked last and charged in the same step as the payment.
4. **`vault::begin` / `finish`** — creation as a hot potato. `VaultSetup` has no abilities, so the
   transaction that starts a vault must also finish it.

## The one unusual control flow

`execute_transfer` does not abort when the loss envelope would be crossed. It marks the proposal
`BLOCKED`, sets the vault to `LOCKDOWN`, emits `BreakerTripped`, and **returns** — so the
transaction succeeds and those writes persist. The coin is never split and never sent.

Aborting would be the obvious thing and it would be wrong: the abort would roll back the Lockdown
along with everything else, leaving the vault open and the attacker free to try again for the price
of gas. `crossing_the_loss_envelope_freezes_the_vault_instead_of_paying` asserts all three
outcomes — the status, the unchanged balance, and the Lockdown.

## Tests

```bash
sui move build                    # clean, with no warnings
sui move test                     # 75 tests: 35 engine vectors, 40 end to end
sui move test engine_             # the pure vectors
sui move test vault_              # the end-to-end suite
sui move test crossing_the_loss   # one test by name
```

Verified against `sui 1.80.1-671ba71e69c7`.

Note for the test suite: `#[expected_failure]` needs `location = skur::vault` on any test that
asserts a code the vault raises. Without it the attribute expects the abort to originate in the
test module, and the test fails with the right code and the wrong module.

[`tests/engine_tests.move`](tests/engine_tests.move) pins the classifier and the policy rules. The
same vectors are pinned in TypeScript in [`../sdk/test/engine.test.ts`](../sdk/test/engine.test.ts);
both suites have to agree, because the only thing worse than a wrong tier is two components
disagreeing about it.

[`tests/vault_tests.move`](tests/vault_tests.move) is named after the attacks rather than the
functions. `a_removed_signers_approval_stops_counting`, `splitting_a_drain_does_not_beat_the_daily_cap`
and `an_agent_cannot_execute` say what they defend; `test_execute_transfer_3` would not.

## Conventions

- **Durations are milliseconds**, because that is what `sui::clock` reports. Converting at each
  comparison is how an off-by-one-thousand gets in.
- **Amounts are `u64`** in the coin's smallest unit, and any intermediate that could overflow —
  exposure, the velocity comparison, the envelope limit — is computed in `u128`.
- **Validation returns a code, and a separate function aborts with it.** An interface can dry-run a
  draft policy and show the precise reason; the vault asserts with the same number.
- **Zero means "no limit"** for every cap and threshold. This is load-bearing: it is why
  `threshold_loosens` cannot be a plain `>`.
- **Effects before interactions.** The proposal's status is written before any coin moves. Move has
  no dynamic dispatch into a caller, so reentrancy is absent by construction rather than defended
  against, but the ordering is kept anyway because it costs nothing and survives a refactor.

## Verifying against a real chain

The unit suites cannot prove that the BCS layouts match these structs, that the PTB builders
produce transactions the vault accepts, or that the events decode back into the shapes the indexer
projects. A wrong field offset passes every unit test and then reads a plausible wrong number off
the chain.

```bash
scripts/verify-local.sh
```

Starts a throwaway local network, publishes ephemerally, and runs
[`../sdk/scripts/e2e.ts`](../sdk/scripts/e2e.ts) against it: create, read back, deposit, preview,
open, approve, prove the activation delay refuses an early execution, execute, prove probation
expires, and decode every event. Nothing touches a public network or your `~/.sui`.

This found a real bug the unit tests could not: the SDK's abort-code parser was scanning for the
first run of digits, so `MoveAbort in 1st command, abort code: 119` reported code **1**, and a
signer held up by a recipient's activation delay was told their policy needed more approvals.

## Publishing

```bash
scripts/publish.sh testnet
```

Builds, runs the tests, publishes, and writes [`deployments/testnet.json`](deployments/). It will
not publish a package whose tests fail.

Two things about the package-management model, because it changed and the old shape silently fails:

- **`mainnet` and `testnet` are system environments.** They are built in and must *not* be declared
  in `[environments]` — doing so fails with "cannot override default environments". Any other
  network needs an entry with its chain identifier from `sui client chain-identifier`, and devnet's
  changes every time it is wiped.
- **`Published.toml` records the published address** and is committed, so other packages can depend
  on this one. `published-at` and `[addresses]` in `Move.toml` are the old system and are gone.
  `Move.lock` pins the framework revision the package was built against and is also committed —
  reproducing a build means reproducing that pin.
