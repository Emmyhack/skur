# Skur V1 design decisions

Each entry resolves an open question from the product blueprint or records a choice the contracts now enforce. Changing any of these is a security decision and needs a matching invariant, test and policy-simulator scenario.

## D1. Authoring language: Solidity, not Scriipture TypeScript

See [scriipture-capability-report.md](scriipture-capability-report.md). Scriipture 0.1.0 cannot express events, enums, structs, ERC-20 interface calls or parameterised errors. Contracts are Solidity 0.8.28 with OpenZeppelin 5.1.0, built and tested with Foundry.

## D2. Risk tiers: LOW / HIGH / CRITICAL, no MEDIUM

Three tiers keep every escalation explainable in one sentence ("bumped one tier because the recipient is in probation"). Every escalation rule is a `+1 tier` or `at least X` step, so an intermediate tier would only add configuration surface without a new control. The reason bitmask on each proposal is how the interface explains the tier.

## D3. Exposure is per asset, in that asset's units

`exposureBps = amount / vault balance of the same asset`. No cross-asset valuation and therefore no oracle. Amount tiers and velocity caps are also per asset. The devnet stablecoin `SkurTestUSD` (6 decimals) stands in for USDC; registering any asset is itself a security-reducing governance change.

## D4. Velocity accounting: anchored 24-hour buckets

`daySpent` resets when 24 hours have passed since the bucket started. A bucket boundary lets an attacker spend up to two daily caps across 24 hours; the per-transaction cap, the circuit-breaker envelope and guardian veto bound that. Rolling windows were rejected for gas and because the invariant "bucket spend never exceeds cap" is directly checkable against a storage aggregate.

## D5. Circuit breaker latches into Lockdown instead of paying

The envelope is `envelopeBps` of the asset balance snapshotted at window start. An execution that would exceed it does **not** revert: it emits `CircuitBreakerTripped`, moves the vault to Lockdown and leaves the proposal pending. Reverting would let the attacker simply retry with a smaller amount; latching forces the strong exit process. The daily cap, by contrast, is a plain block (revert).

## D6. Recipients in probation cannot receive funds before activation

`executableAfter = max(now + tierDelay, activatesAt)`, and the tier is bumped. A brand-new address therefore always waits the activation delay, is escalated, and is guardian-vetoable. Unknown addresses are auto-registered at proposal time; pre-registering starts the clock early.

## D7. Requirements are pinned at creation and can only tighten

A proposal stores its tier, required approvals, guardian confirmations and `executableAfter`. At execution the policy in force is consulted again and the larger requirement wins. A policy that is later loosened never weakens an in-flight proposal; one that is tightened applies immediately.

## D8. Approvals are recounted against live membership at execution

Approver lists are stored per proposal and counted at execution against current roles. A removed signer's approval stops counting without any bookkeeping on removal.

## D9. Guardian veto scope

A single guardian can veto: any security-reducing governance proposal, any CRITICAL transfer, any transfer to a recipient in probation, and any transfer while the vault is not in Normal mode. Veto is always safe (it can only stop money moving), so it needs no quorum. Guardian *confirmation* (a positive act) uses `guardianThreshold`.

## D10. Mode transitions

Any owner or guardian can raise the mode immediately. Leaving Lockdown needs the governance threshold, `guardianThreshold` confirmations, the policy-change delay, and is vetoable. Leaving Elevated needs the same minus the delay. Tightening governance changes and recovery still execute in Lockdown; outgoing transfers and loosening changes do not.

## D11. Recovery: guardian quorum, long delay, owner-cancellable

Guardians propose replacing one signer with a new address that inherits exactly the same role bits. It executes after `recoveryDelay`, any owner can cancel during the delay, and the vault moves to Elevated when it completes. Policy version is untouched. This is symmetric: compromised guardians cannot take over without the real owners noticing for the whole delay, and compromised owners cannot replace guardians without going through the delayed, vetoable governance path.

## D12. Guardian set composition

Guardians hold no treasury role bits (enforced by `_validateRoles`). Veto is 1-of-N, confirmation and recovery are `guardianThreshold`-of-N. Templates ship with one guardian for small teams and two for DAO and fund profiles. A cold-storage guardian is a deployment choice, not a contract concept.

## D13. Not upgradeable

Vaults are EIP-1167 minimal proxies over one immutable implementation. There is no admin, no upgrade slot and the factory has no authority over vaults. Migration means creating a new vault and moving funds through the old vault's own policy. The implementation is deployed as a top-level contract and passed to the factory constructor, because the devnet Blockscout does not index contracts created inside another constructor and the implementation must be source-verified for the no-backend fallback to hold.

## D14. Governance thresholds are counts, not weights

`governanceThreshold` owner approvals, `approvalsLow/High/Critical` approver approvals. Weighted voting is out of V1 scope.

## D15. Proposal expiry

Every proposal expires `proposalTtl` after creation. Policy validation requires `proposalTtl >= longest delay + 1 hour` so every proposal has a real execution window. Anyone can call `expire` to keep the pending counter exact.

## D16. Recipient payment history is recorded but not yet a risk input

`paymentCount` and `totalPaid` are tracked and shown in the interface. Using them to relax or tighten tiers is deferred until a rule can be stated that is as explainable as the current ones.

## D17. Endpoints live in two config files only

`contracts/foundry.toml` (`[rpc_endpoints]`, `[etherscan]`) and `web/src/config/chain.ts`. Nothing else may inline an Ark host name, so the move from `sslip.io` to an Ark-owned domain is a two-file change.

## D18. Reading the devnet: no JSON-RPC batching, windowed log scans, no indexer

Measured on the Ark devnet RPC: a JSON-RPC batch is worked through almost serially (about 0.4 s per entry, 8.5 s for 20 calls), while 20 concurrent single requests return in about 3 s, and `eth_getLogs` refuses any range wider than 10,000 blocks. The interface therefore sends single requests, scans logs in 9,000-block windows with the last window ending at `latest`, caches proposals once they reach a terminal status, re-reads live approvals only for pending ones, and refetches a few more times after a write so a slow receipt still shows up. Full history without an indexer stays acceptable at devnet scale; a mainnet deployment should add one rather than widen these scans.
