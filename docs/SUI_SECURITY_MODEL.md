# Skur security model (Sui / Move)

What each control is, where it is enforced, and which test proves it.

The claim is bounded and worth stating before anything else: **Skur adds independent, programmable
controls that can limit or delay damage even when authorized credentials are misused.** It does not
make signer compromise harmless. Anyone who reads this document and concludes otherwise has read it
wrong.

Module paths are under [`sui/sources/`](../sui/sources/); tests under [`sui/tests/`](../sui/tests/).

## Two control planes

| Plane | Role bits | Can | Cannot |
|---|---|---|---|
| Treasury | `OWNER(1)`, `APPROVER(2)`, `EXECUTOR(4)`, `PROPOSER(16)` | open a payment (any treasury role), approve one (approver), execute one (executor), run governance (owner) | veto, confirm, hold the guardian role |
| Guardian | `GUARDIAN(8)` | raise the mode including straight to Lockdown, veto, confirm critical payments, restrict or block a recipient alone, open a recovery | hold any treasury bit, open a payment, approve one, execute one, run governance |

The exclusivity is `types::roles_valid`, and every path that writes a role goes through it:
`begin`, `execute_member` and `execute_recovery` all call `apply_roles`, which asserts it again.
There is no path that installs a role without it.

`PROPOSER` is the automation role. It satisfies `can_propose` and nothing else — not approval, not
confirmation, not execution, not governance.

## The lifecycle, as implemented

1. **`propose_transfer<T>`** refuses a blocked recipient, an unapproved asset, a zero amount, an
   amount over the per-transaction cap, an amount over what is left of the day, and anything at or
   above the hard block. Then it classifies the payment through `risk::classify` and pins the tier,
   the reasons, the exposure, the required approvals, the required guardian confirmations,
   `executable_at` (the tier's delay, or the recipient's activation time, whichever is later) and
   `expires_at`.
2. **`approve`** takes the approver role for a payment and the owner role for governance, and
   records the approval against the address. **`reject`** takes the same role and records the
   opposite, settling the proposal once as many signers have rejected it as it needed to be
   approved. **`confirm`** takes the guardian role.
3. **`execute_transfer<T>`** re-evaluates everything against live state — see below — and only then
   writes the status, charges the windows, and moves the coin.

Governance kinds share the same path through `open_governance` and `authorize_governance`, so there
is one place where a proposal becomes effective and one place to audit.

## What execution re-checks

This is the function to read: `execute_transfer` in [`vault.move`](../sui/sources/vault.move).

| Re-checked | Why it cannot be checked only at proposal |
|---|---|
| The asset is still approved | Governance can revoke an asset while a payment is in flight |
| Balance covers the amount | The vault may have paid something else since |
| Recipient is not blocked, and has activated | A guardian can block an address after it was approved |
| Per-transaction and daily caps, under the current mode | The mode may have risen to Elevated, halving both |
| The hard block, against the live balance | A smaller balance makes the same amount a larger share |
| The tier, reclassified | Every input above may have moved |
| Approvals and confirmations, recounted against live roles | A signer may have been removed since approving |
| The timelock, against the live delay as well as the pinned one | The policy may have tightened |
| The loss envelope | Checked last, and charged in the same step as the payment |

Requirements are **pinned, then tighten-only**: the stricter of the pinned and the live requirement
applies. Tightening the policy affects payments already in flight; loosening it cannot rescue one.

The order of those checks is itself part of the design. The recipient's activation is checked before
the tier's timelock, so a payment to an address that is still in probation is refused *for that
reason* rather than with a generic "too early" — which is the difference between a signer
understanding what to do and a signer retrying.

## Invariants, and the test that proves each

| # | Invariant | Enforced by | Proven by |
|---|---|---|---|
| 1 | Nothing executes before every active condition is met | the ordered assertions in `execute_transfer` | `a_new_recipient_cannot_skip_activation`, `one_signer_cannot_clear_a_high_tier_payment` |
| 2 | A guardian cannot move treasury assets through guardian authority | `types::roles_valid`, role gates on propose/approve/execute | `a_guardian_cannot_open_a_payment`, `a_guardian_cannot_hold_a_treasury_role` |
| 3 | Lockdown stops outgoing execution and new payments | `assert_not_lockdown` in `propose_transfer` and `execute_transfer` | `lockdown_stops_new_payments_from_being_opened` |
| 4 | A security-reducing change never takes effect immediately | `policy::reductions`, `limit_reductions`, `trust_reduces`, and the delay in `open_governance` | `loosening_the_policy_has_to_wait`, `loosening_the_policy_succeeds_once_the_delay_has_run`, `a_guardian_can_veto_a_weakening`, `tightening_the_policy_takes_effect_as_soon_as_owners_agree` |
| 5 | Cumulative outflow cannot be bypassed by splitting | the day bucket and the envelope in `execute_transfer` | `splitting_a_drain_does_not_beat_the_daily_cap`, `velocity_pressure_escalates_mid_drain` |
| 6 | A proposal cannot execute twice | status written before the coin moves, `settle` decrements once | `a_payment_cannot_execute_twice` |
| 7 | A removed signer's approval stops counting | `count_with_role` against the live roster at execution | `a_removed_signers_approval_stops_counting` |
| 8 | An approval cannot be duplicated or replayed | one entry per address in a `VecSet`, checked before insert | `an_approval_cannot_be_replayed` |
| 9 | A new recipient cannot skip its activation delay | `executable_at = max(delay, activates_at)`, re-asserted at execution | `a_new_recipient_cannot_skip_activation` |
| 10 | Recovery cannot quietly weaken the vault | `execute_recovery` copies the roles it finds now, leaves the policy untouched, and raises the mode | `recovery_moves_the_roles_and_leaves_the_vault_elevated`, `recovery_cannot_skip_its_delay`, `any_owner_can_cancel_a_recovery` |
| 11 | Balance accounting reconciles | one `Balance<T>` per type in a `Bag`; `balance::split` is the only outgoing path | `a_routine_payment_needs_one_approval_and_no_wait`, `the_daily_bucket_reopens_after_a_day` |
| 12 | The roster always satisfies the policy | `assert_counts_valid` after `finish`, `execute_member` and `execute_recovery` | `counts_must_satisfy_the_policy`, and the roster assertions in the recovery tests |
| 13 | The breaker's latch survives the attempt | `execute_transfer` returns without aborting, so the Lockdown write commits | `crossing_the_loss_envelope_freezes_the_vault_instead_of_paying` |
| 14 | Leaving a raised posture is never unilateral | `propose_mode_relax` needs owners, guardians and the policy-change delay | `leaving_lockdown_takes_owners_a_guardian_and_time`, `owners_alone_cannot_lift_a_freeze` |
| 15 | An automation key cannot authorize itself | `PROPOSER` satisfies only `can_propose` | `an_agent_cannot_approve_its_own_proposal`, `an_agent_cannot_execute`, `an_agent_cannot_reject`, `a_proposer_can_only_propose` |
| 16 | Rejecting takes as many signers as approving | `reject` counts rejections against live roles and compares to `req_approvals` | `one_rejection_does_not_turn_down_a_payment_that_needs_two`, `as_many_rejections_as_approvals_turns_a_payment_down`, `a_rejected_payment_cannot_execute` |

Reentrancy is absent by construction rather than defended against: Move has no dynamic dispatch
into a caller, and the only outgoing value movement is `transfer::public_transfer` of a coin split
after the status has been written.

## Threats, mapped to what the contract does

| Threat | What happens |
|---|---|
| One signer compromised | Cannot reach any tier's threshold alone unless `approvals_low` is 1 — and even then the payment is bounded by the routine maximum, the per-transaction cap, the day's remaining allowance and the envelope |
| Enough signers compromised | The high and critical delays are a guardian's veto window; a critical payment needs a guardian; the envelope latches the vault on the first attempt that would cross it |
| An owner quorum weakens the policy | The change waits out `policy_change_delay`, any guardian can veto it, and it cannot be opened at all in Lockdown |
| A drain split into many payments | The day bucket and the envelope count cumulatively; crossing half the day's allowance escalates every further payment |
| A new malicious recipient | Escalated every time while unknown, forced to wait out activation once registered, and vetoable |
| A guardian key compromised | There is no withdrawal path. A recovery waits `recovery_delay` and any owner cancels it. A guardian can freeze, veto and block |
| An automation key compromised | A queue of proposals nobody approved |
| The interface compromised | Every requirement is computed on chain. `preview_transfer` is the same code `execute_transfer` runs, so a preview cannot promise what the vault would refuse, and any interface can reproduce the reads |
| A lost signer | Guardians open a recovery, owners can cancel it, the roles move unchanged, the vault comes out Elevated |
| An emergency | Any owner or guardian enters Lockdown instantly |

## Known limitations

State these to anyone evaluating the system. They are design positions, not oversights.

- **No independent audit yet.** Do not put real value behind Skur until one is complete.
- **Anchored windows, not sliding ones.** A day bucket anchors on its first charge, so up to two
  days' allowance can leave across a boundary. The envelope and the per-transaction cap bound it,
  and the maximum-loss view says so explicitly rather than quietly assuming the best case.
- **Exposure is per asset.** A vault holding several coin types has several independent exposure
  calculations and no portfolio-wide number. Producing one would need an oracle, and a wrong
  portfolio number is worse than an honest per-asset one.
- **The breaker latches; it does not refund.** Everything that executed before the trip stays paid.
  What it buys is that the trip happens *instead of* the payment that would have crossed the line,
  not after it.
- **The envelope basis is the balance when the window opened.** That is deliberate — measuring
  against the live balance would let a drain shrink its own denominator — but it means a large
  deposit mid-window does not raise the window's allowance until the window rolls.
- **Single-guardian vaults.** With `guardian_threshold = 1`, one guardian key both freezes and (with
  owners) unfreezes. The protocol, fund and larger templates ship with two.
- **A shared object serializes.** Every write to a vault goes through consensus on that object, so
  one vault has a throughput ceiling. For a payments treasury doing thousands of payments an hour
  that is a real constraint, and the answer is several vaults rather than pretending otherwise.
- **No arbitrary contract calls in V1.** Only coin transfers exist. "Unlimited approval" and
  "malicious contract interaction" are excluded by construction rather than analysed — which is
  also why decoding arbitrary calls is on the roadmap rather than claimed as done.
- **`register_recipient` does not auto-promote.** Paying an unknown address does not make it known;
  only governance changes trust. A payment to a never-registered address is escalated every time,
  forever, which is intended and occasionally surprising.
