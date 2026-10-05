/**
 * Move abort codes, mapped to the sentence a person should read. The numbers are the constants in
 * `sui/sources/policy.move` and `sui/sources/vault.move`; a change there is a change here.
 *
 * A Sui abort arrives as a `MoveAbort` in the execution status, carrying the module and the code,
 * so an interface can be specific about why a transaction was refused rather than saying "failed".
 */
export const POLICY_ERRORS: Record<number, string> = {
  1: 'Routine transfers must need at least one approval.',
  2: 'High-risk transfers cannot need fewer approvals than routine ones.',
  3: 'Critical transfers cannot need fewer approvals than high-risk ones.',
  4: 'Governance must need at least one owner.',
  5: 'Guardian confirmation is required but no guardian confirmations were set.',
  6: 'The critical delay cannot be shorter than the high-risk delay.',
  7: 'The high exposure threshold cannot exceed the critical one.',
  8: 'Exposure thresholds cannot exceed 100%.',
  9: 'The hard block cannot sit below the critical exposure threshold.',
  10: 'The hard block cannot exceed 100%.',
  11: 'The loss envelope cannot exceed 100%.',
  12: 'The envelope window must be at least one hour.',
  13: 'Proposal lifetime must exceed the longest delay by at least an hour.',
  20: 'The routine maximum cannot exceed the high-tier maximum.',
  21: 'The per-transaction cap cannot exceed the daily cap.',
  30: 'A vault needs at least one owner.',
  31: 'A vault needs at least one executor.',
  32: 'The governance threshold exceeds the number of owners.',
  33: 'Critical approvals exceed the number of approvers.',
  34: 'The guardian threshold exceeds the number of guardians.',
};

export const VAULT_ERRORS: Record<number, string> = {
  100: 'That address is not a member of this vault.',
  101: 'Only an owner can do that.',
  102: 'Only an approver can approve a payment.',
  103: 'Only an executor can execute.',
  104: 'Only a guardian can do that.',
  105: 'That role cannot open proposals.',
  106: 'Those roles are not a valid combination.',
  107: 'The vault is in Lockdown.',
  108: 'That asset is not approved for this vault.',
  109: 'No such proposal.',
  110: 'That proposal is no longer pending.',
  111: 'That proposal is of a different kind.',
  112: 'That proposal is for a different asset.',
  113: 'The waiting period has not elapsed yet.',
  114: 'That proposal has expired.',
  115: 'That proposal has not expired yet.',
  116: 'Not enough approvals from current signers.',
  117: 'Not enough guardian confirmations.',
  118: 'The recipient is blocked.',
  119: 'The recipient is still in its activation delay.',
  120: 'Above the per-transaction cap for this asset.',
  121: "Above today's remaining allowance for this asset.",
  122: 'Above the hard block: no amount of approval can clear this.',
  123: 'The vault does not hold enough of that asset.',
  124: 'The amount must be greater than zero.',
  125: 'That proposal is not one a guardian can veto.',
  126: 'That address is already registered.',
  128: 'That is not a valid trust level.',
  129: 'That is not a valid security mode.',
  130: 'That is not a relaxation of the current mode.',
  131: 'Only the proposer or an owner can cancel.',
  133: 'A guardian cannot hold a treasury role.',
  134: 'That asset was already configured.',
  135: 'The member list and the role list are different lengths.',
  136: 'A guardian cannot nominate themselves as a replacement signer.',
  137: 'No such member.',
  138: 'That signer has already voted on this proposal.',
  139: 'Those roles are already set.',
};

export function describeAbort(module: string | undefined, code: number | bigint): string {
  const n = Number(code);
  if (module === 'policy' && POLICY_ERRORS[n]) return POLICY_ERRORS[n];
  if (module === 'vault' && VAULT_ERRORS[n]) return VAULT_ERRORS[n];
  return POLICY_ERRORS[n] ?? VAULT_ERRORS[n] ?? `The vault refused the transaction (code ${n}).`;
}

/**
 * Pull the abort code out of a failed execution, whatever shape the message arrives in.
 *
 * The shapes differ by where the failure happened. A transaction rejected during resolution reads
 * `MoveAbort in 1st command, abort code: 119, in '0x…'`; one that executed and aborted reads
 * `MoveAbort(MoveLocation { … name: Identifier("vault") … }, 119) in command 0`.
 *
 * Scanning loosely for the first run of digits is what a careless version of this does, and it is
 * wrong in a way that matters: in the first shape it finds the `1` of `1st command` and reports
 * code 1, so a signer told "the recipient is still in its activation delay" is instead told
 * "routine transfers must need at least one approval". Both patterns below are anchored on text
 * that only ever precedes the real code.
 */
function abortCode(text: string): number | null {
  const labelled = /abort\s*code:?\s*(\d+)/i.exec(text);
  if (labelled) return Number(labelled[1]);
  const call = /MoveAbort\([\s\S]*,\s*(\d+)\s*\)/.exec(text);
  if (call) return Number(call[1]);
  return null;
}

function abortModule(text: string): string | undefined {
  const identifier = /name:\s*Identifier\(\s*"(\w+)"\s*\)/.exec(text);
  if (identifier) return identifier[1];
  const qualified = /0x[0-9a-fA-F]+::(\w+)::/.exec(text);
  if (qualified) return qualified[1];
  return undefined;
}

/** Turn a failure into the sentence the contract means by it. */
export function describeFailure(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const code = abortCode(text);
  if (code !== null) return describeAbort(abortModule(text), code);
  if (/InsufficientGas|GasBalanceTooLow|InsufficientCoinBalance/.test(text)) {
    return 'Not enough SUI to pay for gas.';
  }
  if (/ObjectNotFound|ObjectDeleted/.test(text)) {
    return 'That object no longer exists on this network.';
  }
  if (/ObjectVersionUnavailable|ObjectLockConflict/.test(text)) {
    return 'The vault was changed by someone else a moment ago. Read it again and retry.';
  }
  return text;
}
