# What already exists on Sui, and what it does not do

Research pass: 2026-10-05. Purpose: decide what V1 has to be so that it is not a second
multisig, and so that the grant application can say precisely what is missing from the ecosystem
today.

## The three things a Sui organization can use today

### 1. Sui native multisig (protocol-level)

Built into the protocol. A multisig address is a committee of up to **10 public keys**, each with
a weight, and a threshold. It can mix key schemes (Ed25519, ECDSA Secp256k1, Secp256r1), which is
genuinely useful — a Ledger, a passkey and a hot key can sit in the same committee.

What it is: **signature aggregation**. The chain checks that the weights of the supplied
signatures reach the threshold, and then the transaction executes exactly as any other.

What it cannot express, at all:

- any dependence on **what** the transaction does — the same threshold clears a $10 invoice and
  the entire treasury;
- any dependence on **who receives** it;
- any dependence on **what has already happened today**;
- any delay, any freeze, any veto, any recovery.

There is also no onchain proposal object: coordination happens offchain, by passing partial
signatures around. There is nothing to query, index, or show a reviewer.

### 2. account.tech (formerly Kraken) — Smart Account Framework

The most serious piece of engineering in this space, and the real benchmark. A shared, programmable
account object with an **intent-based architecture**: an intent is created, resolved against the
account's `Config`, and then executed.

Implemented: configurable ownership rules, **role-based permissions**, asset and object management,
**payments and vestings** (recurring transfer intents), currency control (locking a `TreasuryCap`),
package upgrade control (locking `UpgradeCap`s) with **an optional time-lock on upgrades**, and
dependency whitelisting so only approved packages can touch account state.

Not implemented, by its own documentation: spending limits or transaction caps, recipient
allowlists or denylists, risk scoring, emergency freeze, social recovery.

The shape of it matters: account.tech is an **extensibility** framework. Its security story is
"only approved packages may act, and the config decides who may act." That is a different axis
from ours. It makes a treasury *programmable*; it does not make a treasury *defended*. The upgrade
timelock is the only time-based control, and it protects code, not money.

### 3. Maven, by the MSafe team

The incumbent product: "the first and only multi-signature non-custodial digital assets management
solution on Sui," live on mainnet since day one. Multi-signature approval, **weighted voting power**
for co-managers, granular role assignment, and **co-signer account recovery**.

Its published documentation does not describe spending limits, recipient allowlists, timelocks,
risk scoring or an emergency freeze.

Maven is the closest thing to a Safe on Sui, and like Safe it is a *threshold* product. Safe's own
answer to policy is a module ecosystem bolted on afterwards; Maven does not have even that yet.

### Also present, worth naming

- **Streamflow** — multichain treasury management (Solana, Aptos, Sui) from one dashboard. Payment
  streaming and vesting, not authorization policy.
- **MPCVault** — multi-chain MPC custody with one approval workflow and an audit log across
  Ethereum, Bitcoin, Solana, TRON, TON, Aptos and Sui. Closest to us on *process* (approval
  workflow, audit log), but it is **offchain policy over MPC custody**: the rules live in a
  company's backend, not in a contract you can read. If their service is compromised or goes away,
  the rules go with it.

## The gap, stated as one sentence

Every option on Sui today answers one question — *did enough of the right keys sign?* — and nothing
answers the question that actually decides whether a treasury survives a compromise: **given the
amount, the destination, the recent outflow and the vault's current posture, how much authorization
should this payment need, and should it be allowed to settle at all right now?**

Concretely, nothing on Sui provides:

| Control | Native multisig | account.tech | Maven | MPCVault | Skur |
|---|---|---|---|---|---|
| k-of-n threshold | yes | yes | yes | yes | yes |
| Roles beyond signer | no | yes | yes | yes | yes |
| Onchain proposal object | no | yes | yes | no | yes |
| Approvals that scale with amount | no | no | no | offchain | **yes** |
| Approvals that scale with share of treasury | no | no | no | no | **yes** |
| Per-transaction and 24-hour caps | no | no | no | offchain | **yes** |
| Cumulative accounting (split-proof) | no | no | no | unclear | **yes** |
| Recipient trust levels | no | no | no | allowlist | **yes** |
| New-recipient activation delay | no | no | no | no | **yes** |
| Risk-tiered timelocks | no | code upgrades only | no | no | **yes** |
| Loss-envelope circuit breaker | no | no | no | no | **yes** |
| Emergency freeze | no | no | no | yes (operator) | **yes (guardian)** |
| Guardian role with no spend path | no | no | no | no | **yes** |
| Tightening-only policy changes | no | no | no | no | **yes** |
| Guardian veto on weakening | no | no | no | no | **yes** |
| Signer recovery with delay + owner cancel | no | no | co-signers | yes (operator) | **yes** |
| Agent/automation role that cannot execute | no | no | no | no | **yes** |
| Rules enforced in Move, readable onchain | n/a | yes | yes | **no** | **yes** |

## What this means for V1

1. **Do not compete on being a multisig.** Native multisig is free and in the protocol; Maven
   already ships the product. Competing there is competing on UI.

2. **Compete on the layer above it.** The pitch is a *programmable authorization and treasury
   security layer*: the thing that decides how much authorization a payment needs and whether it
   may settle now. A Skur vault can sit behind a native multisig or a Maven account as one of its
   owners — we are not asking anyone to abandon the committee they already trust.

3. **Interoperate with account.tech rather than duplicate it.** They own extensibility; we own
   policy. A Skur policy object is a legitimate thing for an account.tech intent resolver to
   consult, and that is a partnership conversation, not a competitive one.

4. **The differentiators that no one can answer quickly** are the ones that require state over
   time, not just a config: cumulative velocity accounting, the loss envelope measured against the
   balance when the window opened, recipient probation, and tightening-only policy changes. Those
   are the four to lead with.

5. **Enforcement in Move is the honest claim against MPCVault.** Their controls are real but they
   are somebody's backend. Ours are in a shared object anyone can read. That is the sentence for
   the funding application.

## Sources

- https://docs.sui.io/develop/transactions/transaction-auth/multisig
- https://github.com/account-tech/move-framework
- https://github.com/account-tech
- https://doc.m-safe.io/sui
- https://sui.directory/project/maven/
- https://blog.sui.io/write-multi-signature-multisig-move-contracts/
