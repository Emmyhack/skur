# Skur threat model

The adversary's view of the system. The companion document,
[SUI_SECURITY_MODEL.md](SUI_SECURITY_MODEL.md), walks the controls one by one and names the test
behind each; this one starts from the attacker and asks what each class of adversary can actually
take, delay, or break — with the bound stated as a number wherever one exists.

Every claim here traces to a named test in [`sui/tests/`](../sui/tests/) or a stated assumption.
Where the honest answer is "this is not defended", it says so.

---

## 1. What is being protected

| Asset | Where it lives | Loss mode |
|---|---|---|
| Treasury funds | `Balance<T>` inside the shared `Vault` object | theft, freeze-out |
| Policy integrity | `Policy` struct inside the vault | weakening that enables later theft |
| Roster integrity | the members table | role capture, guardian displacement |
| Operational continuity | the vault's mode | griefing via unjustified Lockdown |

Non-assets, deliberately: the vault's *existence and contents are public*. Reads are not gated and
confidentiality is not claimed. An adversary learning balances, policy or the queue is the system
working as designed.

## 2. Trust assumptions

What the model stands on. Break one of these and the guarantees below shrink accordingly.

1. **Sui consensus is honest-majority and live.** Equivocation, reorgs deep enough to unwind
   finality, or total censorship are out of scope; they break every object on the chain, not Skur
   specifically.
2. **`sui::clock` is approximately correct.** Delays and windows are measured against the shared
   clock object. Validator-level clock manipulation is out of scope.
3. **Move's type system holds.** `Balance<T>` cannot be forged; abilities are enforced; a struct
   without `store` cannot be smuggled out. A Move VM soundness bug is out of scope.
4. **The secure element does its job.** On mobile, the signing key is generated in and released by
   the device keystore behind a biometric. Extraction from a locked, un-rooted device is out of
   scope; a rooted device demotes the key to "hot key an attacker can use while holding the
   phone" — which the model below already prices in as "one compromised signer".
5. **At least one guardian key is held independently.** The product tells users this at every
   turn: a guardian key on the same phone as a signer key collapses the two planes. The model
   assumes the advice was taken; §6 shows what remains when it was not.

Explicitly **not** assumed: an honest backend, an honest frontend, an honest wallet UI, honest
co-signers, or an honest majority of owners below the governance threshold.

## 3. Adversary classes and their bounds

The bound for money-out attacks is always the same four-term expression, computed per asset:

> **max loss = min(per-tx cap, day allowance remaining, envelope remaining) per payment,
> summed until the envelope latches — plus nothing after the latch.**

The `computeMaxLoss` engine in the SDK (and the Security screen in every client) evaluates this
honestly, including the anchored-window caveat (§5).

### A. One compromised treasury signer

*Capability:* open payments; contribute one approval; execute if also executor.

- Alone, clears only tiers with `approvals = 1` — the routine tier in shipped templates — so each
  payment is bounded by `low_max`, and the run is bounded by the day cap and the envelope.
- Cannot raise its own authority: governance needs `governance_threshold` owners
  (`counts_must_satisfy_the_policy`), and an approval recorded while holding the role stops
  counting the moment the role is gone (`a_removed_signers_approval_stops_counting`).
- Cannot replay an approval (`an_approval_cannot_be_replayed`) or double-execute
  (`a_payment_cannot_execute_twice`).
- Sending to itself or a mule hits recipient trust: an unregistered address escalates every
  payment (`an_unknown_recipient_is_escalated_without_being_registered`); registering one starts
  it restricted and waits out activation (`a_new_recipient_cannot_skip_activation`,
  `registering_a_recipient_starts_it_at_the_restrictive_default`).

**Bound:** the routine drip, cut off by velocity (`splitting_a_drain_does_not_beat_the_daily_cap`,
`velocity_pressure_escalates_mid_drain`) and latched by the envelope
(`crossing_the_loss_envelope_freezes_the_vault_instead_of_paying`).

### B. A full approval quorum compromised (k of n signers)

*Capability:* clear any tier's approvals.

- High and critical tiers still **wait** (`delay_high`, `delay_critical`) — the delay exists to be
  a veto window, and a guardian veto both stops the payment and raises the posture
  (`a_guardian_veto_stops_a_critical_payment_and_raises_the_posture`).
- Critical payments additionally need a guardian confirmation the attacker does not have
  (`one_signer_cannot_clear_a_high_tier_payment` generalises; `requirements_follow_the_tier`).
- The hard-block line cannot be approved around (`the_hard_block_cannot_be_approved_around`), and
  the first payment that would cross the envelope trips Lockdown instead of paying.
- Execution re-derives requirements against **live** state and applies the stricter of pinned vs
  live — a quorum assembled yesterday does not help against a posture raised today.

**Bound:** everything below the high tier immediately; the high tier after its delay if no
guardian acts; the critical tier never without a guardian. Cumulative total still enveloped.

### C. An owner coalition below the governance threshold

*Capability:* none that matters. Governance actions count owner approvals against
`governance_threshold`; below it, proposals sit in the queue. Rejections are symmetric and final
(`as_many_rejections_as_approvals_turns_a_payment_down`, `a_rejected_payment_cannot_execute`).

### D. A governance quorum turned malicious (or coerced)

*Capability:* propose any policy or roster change.

This is the strongest insider adversary the design engages, and the firewall is built for it:

- **Tightening is instant; loosening is not.** Every change is diffed field by field, including
  disguises — zeroing a threshold to disable it, lengthening proposal lifetimes, approving a new
  asset (`zeroing_the_envelope_is_a_reduction`, `a_longer_proposal_lifetime_is_a_reduction`,
  `approving_a_new_asset_is_a_reduction`, `weakening_a_cap_to_zero_is_a_reduction`).
- Any reduction waits `policy_change_delay` and **any single guardian vetoes it**
  (`a_guardian_can_veto_a_weakening`); in Lockdown it cannot even be proposed
  (`lockdown_stops_new_payments_from_being_opened` extends to proposals by mode gate).
- Displacing the guardian from the roster is itself a governance action with the same delay and
  the same veto — the coalition must win the race against the very key whose job is noticing.

**Bound:** a quorum plus *every* guardian asleep for the full delay. That conjunction is the
residual risk, stated in §6.

### E. A compromised guardian key

*Capability:* freeze, veto, confirm, block recipients, open recoveries.

- **No withdrawal path exists** — the contract refuses the combination at the type level
  (`a_guardian_cannot_hold_a_treasury_role`); a guardian cannot open, approve or execute a payment
  (`a_guardian_cannot_open_a_payment`).
- The damage mode is **griefing**: unjustified Lockdown, vetoes, nuisance recoveries. Lockdown
  exit deliberately needs owners + a guardian + time (`leaving_lockdown_takes_owners_a_guardian_and_time`,
  `owners_alone_cannot_lift_a_freeze`); a hostile recovery waits `recovery_delay` and **any one
  owner cancels it** (`any_owner_can_cancel_a_recovery`, `one_owner_can_reject_a_recovery`).

**Bound:** denial of service for bounded periods; zero direct theft. Multi-guardian templates
dilute even the griefing.

### F. A compromised automation key (`PROPOSER`)

*Capability:* open proposals. Only that (`a_proposer_can_only_propose`,
`an_agent_cannot_approve_its_own_proposal`, `an_agent_cannot_execute`, `an_agent_cannot_reject`).

**Bound:** a queue of unapproved proposals — noise, each item expiring on its TTL
(`a_proposal_expires_and_cannot_be_revived`).

### G. A malicious frontend, backend, or wallet UI

*Capability:* lie to humans; it cannot lie to the chain.

- Every requirement is computed on chain; `preview_transfer` is the same code `execute_transfer`
  runs (`a_preview_matches_what_the_vault_will_demand`), so a cooked preview cannot make the vault
  accept what it would refuse.
- The indexer/notification backend is **advisory by design** — it can see across vaults and wake
  humans up; it cannot approve, delay, or waive anything (see `server/src/advisory.ts`'s header).
- What a lying UI *can* do is the classic wallet-drainer move: display payment X while submitting
  payment Y for signature. Skur narrows this — V1 transactions are coin transfers only, no
  arbitrary calls — and the mobile app computes its review screen from chain reads, but a user who
  signs blind on a compromised device is signing blind. Stated as residual in §6.

### H. A thief with the unlocked phone

*Capability:* whatever that device's key can do — i.e. exactly adversary A (or E, if the owner
ignored the hot-key warning), gated per action by the biometric the thief does not have. The
keystore releases the key one action at a time; there is no session token to steal. Losing the
device entirely is the **recovery** path: roles move to a new key after `recovery_delay`, any
owner can cancel, the vault exits Elevated (`recovery_moves_the_roles_and_leaves_the_vault_elevated`,
`recovery_cannot_skip_its_delay`).

## 4. Kill-chain walkthroughs

Three attacks, end to end, against a shipped startup-template vault
(1/2/2 approvals, 1 guardian, 10 % envelope per day).

**The drip.** A steals one signer key, scripts routine-max payments to a fresh address. Payment 1:
unknown recipient escalates it out of the routine tier → needs a second approval A doesn't have.
A registers the address instead: activation delay, restricted default, visible in every client's
queue with a push notification out. Dead before money moves.

**The smash.** B compromises both signers, proposes 24 % of holdings. Share-of-holdings escalates
to critical (`share_of_treasury_escalates_on_its_own`) → needs the guardian; without it, never
executes. B tries 9 % instead: high tier, waits a day on the clock in front of every member and
the guardian's phone. Repeat attempts stack into the envelope; the attempt that would cross 10 %
latches Lockdown, keeping ~90 % regardless of anyone reacting at all.

**The quiet coup.** D's quorum proposes `approvals_critical: 2 → 1` dressed inside an otherwise
tightening change. The field diff flags the reduction; the proposal waits `policy_change_delay`
flagged *weakens the vault* in every surface; one guardian veto ends it and the attempt is
permanent, attributed chain history.

## 5. Accepted weaknesses (design positions)

Inherited from the security model, restated adversarially:

- **Anchored windows**: a patient attacker straddling a bucket boundary gets up to two days'
  allowance in quick succession. The envelope and per-tx caps still bound it; the max-loss screen
  prices it in.
- **Envelope basis is window-open balance**: a deposit mid-window doesn't raise the allowance —
  the safe direction — but the symmetric surprise is that it doesn't.
- **Per-asset exposure, no portfolio oracle**: an attacker can prefer the asset where their
  amount is a smaller share. Caps are per-asset for exactly this reason; set them that way.
- **Latching is not refunding**: the breaker stops the crossing payment, not its predecessors.

## 6. Residual risk register

| # | Residual | Needed for it | Mitigation posture |
|---|---|---|---|
| R1 | Full theft via governance | owner quorum **and** every guardian passive for the whole delay | more guardians, longer `policy_change_delay`, guardians on hardware off-site |
| R2 | Blind signing on a rooted/compromised device | user device compromise + user signs without reading | V1's transfer-only surface, chain-computed reviews; ultimately a device-security boundary |
| R3 | Routine-tier drip within all caps | one signer key, patient | set `approvals_low: 2` where throughput allows; watch notifications |
| R4 | Guardian griefing | one guardian key | multi-guardian templates; recovery + owner-cancel as the counterweight |
| R5 | Vault throughput ceiling | none (physics of one shared object) | shard into several vaults |
| R6 | Everything in §2's assumptions | breaking Sui, Move, or the secure element | out of scope by declaration, not by hand-waving |

## 7. Out of scope, explicitly

Validator-level attacks on Sui; Move VM soundness; secure-element extraction; side channels on
the user's hardware; social engineering that convinces a *quorum plus the guardians* to approve a
theft on purpose (no mechanism survives its own operators conspiring at full strength — the design
goal is that nothing *less* than that conjunction suffices, and §3 shows the price of each lesser
coalition).

## 8. Standing honesty

No independent audit has been performed. This document is the map the auditor should try to tear;
until one has, do not put real value behind Skur. The apps, the site and the README carry the same
sentence on purpose.
