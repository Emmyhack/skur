import { describe, expect, it } from 'vitest';
import { describeAbort, describeFailure } from '../src/errors';

/**
 * Every string here is a shape a real node produced, not one I imagined. The first test is the
 * reason this file exists: the original parser scanned for the first run of digits and found the
 * `1` in `1st command`, so an abort with code 119 was reported as code 1 — and a signer whose
 * payment was held by a recipient's activation delay was told their policy needed more approvals.
 *
 * A local end-to-end run caught it. No unit test written against imagined shapes would have.
 */
describe('reading an abort code out of a failure', () => {
  it('does not mistake the ordinal in "1st command" for the code', () => {
    const real =
      "Transaction resolution failed: MoveAbort in 1st command, abort code: 119, in '0x5ee47804bf9511f46cb26d9de652642fa1f7473d2ba6bb54169d9aaf453d180f'";
    expect(describeFailure(real)).toBe('The recipient is still in its activation delay.');
  });

  it('reads the labelled form at any command index', () => {
    expect(
      describeFailure("MoveAbort in 3rd command, abort code: 120, in '0xabc'"),
    ).toBe('Above the per-transaction cap for this asset.');
    expect(
      describeFailure("MoveAbort in 2nd command, abort code: 13, in '0xabc::policy::assert_valid'"),
    ).toBe('Proposal lifetime must exceed the longest delay by at least an hour.');
  });

  it('reads the executed form, where the code is the second argument', () => {
    const executed =
      'MoveAbort(MoveLocation { module: ModuleId { address: 5ee47804, name: Identifier("vault") }, function: 12, instruction: 60, function_name: Some("execute_transfer") }, 116) in command 0';
    expect(describeFailure(executed)).toBe('Not enough approvals from current signers.');
  });

  it('resolves the module from either shape', () => {
    const identifier =
      'MoveAbort(MoveLocation { module: ModuleId { address: 1, name: Identifier("policy") }, function: 1, instruction: 2 }, 5) in command 0';
    expect(describeFailure(identifier)).toBe(
      'Guardian confirmation is required but no guardian confirmations were set.',
    );
    expect(
      describeFailure("MoveAbort in 1st command, abort code: 107, in '0xabc::vault::propose_transfer'"),
    ).toBe('The vault is in Lockdown.');
  });

  it('covers every code the Move modules can raise', () => {
    // The ranges are disjoint by design — policy aborts below 100, the vault at 100 and above —
    // so a code resolves to one sentence whether or not the module came through.
    for (const code of [1, 13, 20, 30, 34]) {
      expect(describeAbort(undefined, code)).not.toMatch(/^The vault refused/);
    }
    for (const code of [100, 119, 122, 139]) {
      expect(describeAbort(undefined, code)).not.toMatch(/^The vault refused/);
    }
  });

  it('says so plainly for a code it does not know', () => {
    expect(describeFailure('MoveAbort in 1st command, abort code: 9999, in \'0xabc\'')).toMatch(
      /code 9999/,
    );
  });

  it('recognises the failures that are not aborts at all', () => {
    expect(describeFailure('InsufficientGas: balance too low')).toMatch(/gas/i);
    expect(describeFailure('ObjectNotFound: 0xabc')).toMatch(/no longer exists/);
    expect(describeFailure('ObjectVersionUnavailable for consensus object 0xabc')).toMatch(
      /changed by someone else/,
    );
  });

  it('passes an unrecognised message through rather than inventing one', () => {
    expect(describeFailure('something nobody anticipated')).toBe('something nobody anticipated');
  });
});
