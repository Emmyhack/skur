import { describe, expect, it } from 'vitest';
import {
  AssetLimitsBcs,
  PolicyBcs,
  ProposalBcs,
  RecipientBcs,
  VaultBcs,
  VelocityBcs,
  bcs,
} from '../src/bcs';

/**
 * BCS is positional and silent: a field in the wrong place does not error, it reads the next
 * field's bytes and produces a plausible wrong number. These round-trips will not catch a layout
 * that disagrees with Move — only a deployment can do that — but they do catch the mistakes that
 * happen while editing this file: a width changed, a field dropped, two fields transposed to the
 * same width.
 *
 * Every value below is distinct, so a transposition shows up as a wrong value rather than a
 * coincidence.
 */
const policy = {
  approvals_low: 1,
  approvals_high: 2,
  approvals_critical: 3,
  governance_threshold: 4,
  guardian_threshold: 5,
  guardian_required_critical: true,
  delay_high: '3600000',
  delay_critical: '86400000',
  recipient_activation_delay: '43200000',
  policy_change_delay: '172800000',
  recovery_delay: '259200000',
  proposal_ttl: '2592000000',
  high_exposure_bps: '1000',
  critical_exposure_bps: '2500',
  hard_block_exposure_bps: '9000',
  envelope_bps: '3000',
  envelope_window: '86400000',
};

const limits = {
  approved: true,
  low_max: '1000',
  high_max: '10000',
  per_tx_max: '50000',
  daily_max: '100000',
};

const A1 = `0x${'11'.repeat(32)}`;
const A2 = `0x${'22'.repeat(32)}`;
const A3 = `0x${'33'.repeat(32)}`;

describe('BCS round-trips', () => {
  it('preserves every policy field', () => {
    const parsed = PolicyBcs.parse(PolicyBcs.serialize(policy).toBytes());
    expect(parsed).toEqual(policy);
  });

  it('is fixed width for a policy: five u8, a bool, and eleven u64', () => {
    // 5 + 1 + 11 * 8 = 94. A changed width shows up here before it shows up as a wrong number.
    expect(PolicyBcs.serialize(policy).toBytes()).toHaveLength(94);
  });

  it('preserves the asset limits', () => {
    const parsed = AssetLimitsBcs.parse(AssetLimitsBcs.serialize(limits).toBytes());
    expect(parsed).toEqual(limits);
    expect(AssetLimitsBcs.serialize(limits).toBytes()).toHaveLength(1 + 4 * 8);
  });

  it('preserves the velocity windows, which are all the same width and so the easiest to transpose', () => {
    const velocity = {
      day_anchor: '1',
      day_spent: '2',
      envelope_anchor: '3',
      envelope_spent: '4',
      envelope_basis: '5',
    };
    expect(VelocityBcs.parse(VelocityBcs.serialize(velocity).toBytes())).toEqual(velocity);
  });

  it('preserves a recipient, including its label', () => {
    const recipient = {
      trust: 2,
      registered_at: '1700000000000',
      activates_at: '1700043200000',
      paid_count: '7',
      last_paid: '1700086400000',
      label: 'Payroll — ACME GmbH',
    };
    expect(RecipientBcs.parse(RecipientBcs.serialize(recipient).toBytes())).toEqual(recipient);
  });

  it('preserves a transfer proposal with both payload options empty', () => {
    const proposal = {
      id: '9',
      kind: 0,
      status: 1,
      proposer: A1,
      created_at: '1700000000000',
      executable_at: '1700003600000',
      expires_at: '1702592000000',
      req_approvals: 2,
      req_guardians: 1,
      tier: 2,
      reasons: 321,
      exposure_bps: '2500',
      policy_version: '3',
      reduction_mask: 70000,
      approvals: { contents: [A1, A2] },
      confirmations: { contents: [A3] },
      rejections: { contents: [] },
      asset: { name: '0000000000000000000000000000000000000000000000000000000000000002::sui::SUI' },
      amount: '1234567890',
      recipient: A2,
      memo: 'invoice 1182',
      new_policy: null,
      new_limits: null,
      member: A3,
      member_prev: A1,
      member_roles: 7,
      trust_level: 3,
      target_mode: 1,
    };
    expect(ProposalBcs.parse(ProposalBcs.serialize(proposal).toBytes())).toEqual(proposal);
  });

  it('preserves a governance proposal carrying a policy and limits', () => {
    const proposal = {
      id: '10',
      kind: 1,
      status: 1,
      proposer: A1,
      created_at: '1',
      executable_at: '2',
      expires_at: '3',
      req_approvals: 2,
      req_guardians: 0,
      tier: 0,
      reasons: 0,
      exposure_bps: '0',
      policy_version: '1',
      reduction_mask: 2048,
      approvals: { contents: [] },
      confirmations: { contents: [] },
      rejections: { contents: [A2] },
      asset: null,
      amount: '0',
      recipient: `0x${'00'.repeat(32)}`,
      memo: 'policy',
      new_policy: policy,
      new_limits: limits,
      member: `0x${'00'.repeat(32)}`,
      member_prev: `0x${'00'.repeat(32)}`,
      member_roles: 0,
      trust_level: 0,
      target_mode: 0,
    };
    const parsed = ProposalBcs.parse(ProposalBcs.serialize(proposal).toBytes());
    expect(parsed).toEqual(proposal);
    expect(parsed.new_policy?.envelope_bps).toBe('3000');
  });

  it('preserves a vault, keeping the six table handles distinct and in order', () => {
    const handle = (n: string, size: string) => ({ id: `0x${n.repeat(32)}`, size });
    const vault = {
      id: `0x${'ab'.repeat(32)}`,
      name: 'Skur Demo Treasury',
      policy,
      policy_version: '4',
      mode: 1,
      posture_reasons: 576,
      members: handle('01', '6'),
      owner_count: '2',
      approver_count: '4',
      executor_count: '2',
      guardian_count: '1',
      limits: handle('02', '2'),
      funds: handle('03', '2'),
      velocity: handle('04', '2'),
      recipients: handle('05', '9'),
      proposals: handle('06', '40'),
      next_proposal: '41',
      pending_count: '3',
      created_at: '1700000000000',
    };
    const parsed = VaultBcs.parse(VaultBcs.serialize(vault).toBytes());
    expect(parsed).toEqual(vault);
    // The handles are the part a transposition would quietly swap, and reading the wrong table is
    // the kind of bug that looks like missing data rather than a crash.
    expect(parsed.members.id).toBe(`0x${'01'.repeat(32)}`);
    expect(parsed.proposals.id).toBe(`0x${'06'.repeat(32)}`);
    expect(parsed.proposals.size).toBe('40');
  });

  it('reads a Balance<T> as a bare u64, which is how it is stored in the bag', () => {
    expect(bcs.u64().parse(bcs.u64().serialize('250000000000').toBytes())).toBe('250000000000');
  });
});
