# Skur V1 security model

This is the contract-level view of the blueprint's security model: what each control is, where it is enforced, and which test proves it. The claim Skur makes is bounded: **independent, programmable controls that can limit or delay damage even when authorized credentials are compromised.** Nothing here makes signer compromise harmless.

## Planes and roles

| Plane | Role bits | Can | Cannot |
|---|---|---|---|
| Treasury | `OWNER(1)`, `APPROVER(2)`, `EXECUTOR(4)` | propose (owner/approver), approve (approver), execute (executor) transfers | veto, confirm critical actions, propose recovery |
| Governance | `OWNER(1)` | propose and approve policy, limits, membership, recipient trust, mode relaxation; cancel any proposal; raise mode | approve transfers unless also approver |
| Guardian | `GUARDIAN(8)` | raise mode, veto, confirm critical transfers and mode relaxation, propose and confirm recovery | hold any treasury bit, propose or approve transfers, execute transfers, run governance |

Guardian exclusivity is enforced in `_validateRoles` and holds for every membership path, including recovery.

## Transaction lifecycle as implemented

1. `proposeTransfer` runs `previewTransfer` (deterministic tier + reasons), checks per-transaction cap and hard exposure block, auto-registers unknown recipients, and pins `tier`, `requiredApprovals`, `requiredGuardians`, `executableAfter` (at least the recipient's activation time) and `expiresAt`.
2. Approvers call `approve`; guardians call `approve` to confirm when `requiredGuardians > 0`.
3. `execute` (executor only) checks: not expired, timelock passed, not in Lockdown, live approvals under current roles, requirements re-derived from the current policy if it changed (only ever stricter), recipient not blocked and past activation, balance, per-transaction cap, hard exposure block, daily bucket, circuit-breaker envelope.
4. State and counters update, `ProposalExecuted` and `TransferExecuted` emit, then the external transfer happens (`call{value}` or `SafeERC20.safeTransfer`).

## Invariants and where they are proven

| # | Invariant | Enforced by | Proven by |
|---|---|---|---|
| 1 | No execution before all active conditions | `execute` ordering | `invariant_timelockRespected`, `test_highTierNeedsTwoApprovalsAndDelay`, `test_criticalTierNeedsGuardianAndIsVetoable` |
| 2 | Guardians cannot transfer treasury assets | role exclusivity, role gates on propose/approve/execute | `test_guardianCannotMoveFunds`, `invariant_guardiansNeverMoveFunds`, `invariant_rolesConsistent` |
| 3 | Lockdown blocks ordinary outgoing execution | `execute` lockdown gate, `proposeTransfer` gate | `test_lockdownBlocksOutgoingButNotDepositsOrGuardians`, `invariant_lockdownRespected` |
| 4 | Security-reducing policy changes never take immediate effect | `SkurPolicyLib.policyReduces` and friends, `_createGovernance` delay | `test_looseningPolicyIsDelayedAndVetoable`, `test_mixedChangeCountsAsLoosening`, `test_addingMemberIsDelayedRemovingIsImmediate`, `test_trustedIsSecurityReducingAndDelayed`, `test_approvingNewAssetIsDelayed` |
| 5 | Cumulative outflow cannot be bypassed by splitting | `daySpent` bucket and envelope in `_checkTransfer` | `test_splitDrainHitsDailyCap`, `invariant_dailyCapNeverExceeded`, `invariant_envelopeNeverExceeded` |
| 6 | No proposal executes twice | status set before interaction, `_pending` | `test_cannotExecuteTwice`, `invariant_noDoubleExecution`, `invariant_pendingCountExact` |
| 7 | Removed signers cannot approve new actions | role check in `approve`, live recount in `execute` | `test_removedSignerApprovalStopsCounting` |
| 8 | Approval counting cannot be duplicated or replayed | `hasApproved` per proposal per signer | `test_duplicateApprovalRejected`, `invariant_executedTransfersHadEnoughLiveApprovals` |
| 9 | New recipients cannot bypass activation delay | `executableAfter = max(.., activatesAt)` plus re-check at execution | `test_newRecipientWaitsForActivation`, `test_reProbationRestartsClockAndBlocksPending`, `invariant_probationRespected` |
| 10 | Recovery cannot silently weaken policy | `_applyRecovery` copies roles only, mode to Elevated, policy untouched | `test_recoveryFlow`, `test_recoveryValidation` |
| 11 | Native and ERC-20 accounting is correct | `totalOutflow`, `SafeERC20` | `invariant_nativeAccounting`, `invariant_erc20Accounting`, `test_nonStandardERC20Transfers` |
| 12 | External calls cannot re-enter an unsafe state | `nonReentrant`, effects before interactions | `test_reentrancyBlocked`, Slither reentrancy detectors (clean) |

## Threats mapped to controls

| Threat | What happens in the contract |
|---|---|
| One signer compromised | Cannot reach any tier's threshold alone unless `approvalsLow == 1`; even then LOW is capped by `lowMax`, the daily bucket and the envelope. |
| Enough signers compromised | HIGH/CRITICAL delays give guardians the veto window; CRITICAL needs guardian confirmation; envelope trips Lockdown on the first over-limit attempt. |
| Admin tries to weaken policy | Loosening waits `policyChangeDelay`, is vetoable, and is impossible while in Lockdown. |
| Drain split into many transfers | Daily bucket and envelope count cumulatively; pinned tiers do not matter at execution. |
| New malicious recipient | Forced wait until activation, one-tier bump, vetoable. |
| Guardian compromised | No withdrawal path exists; recovery is delayed and owner-cancellable; guardian can only freeze or veto. |
| Frontend compromised | Every requirement is computed onchain; the wallet shows the calldata; Blockscout-verified source lets any interface reproduce the reads. |
| Lost signer | Guardian recovery after `recoveryDelay`, owners can cancel. |
| Emergency | Any owner or guardian enters Lockdown instantly; leaving needs threshold + guardians + delay. |

## Known limitations (state these to customers)

- **Bucket boundary.** Anchored 24h buckets allow up to two daily caps across a boundary. The envelope and per-transaction cap bound this; the maximum-loss view in the interface accounts for it.
- **Exposure is per asset.** A vault holding several assets has several independent exposure calculations. There is no portfolio-level number without an oracle.
- **Circuit breaker is a latch, not a refund.** Everything executed before the trip stays paid.
- **Single-guardian vaults.** With `guardianThreshold = 1`, one guardian key both freezes and unfreezes (with owners). Templates for larger organisations ship with two.
- **Devnet stablecoin.** `SkurTestUSD` is mintable by anyone. It is a stand-in, not an asset.
- **No contract-call proposals in V1.** Only native and ERC-20 transfers exist, so "unlimited approval" and "malicious contract" threats are excluded by construction rather than analysed.

## Static analysis

`slither . --filter-paths "lib/|test/|script/" --exclude-informational --exclude-optimization` reports fourteen low findings: enum strict-equality false positives, one intentionally unused return, timestamp comparisons required by timelocks, and a benign write-after-call in the factory that was reordered. No medium or high findings.
