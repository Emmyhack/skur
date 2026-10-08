import {
  Kind,
  Mode,
  Role,
  Status,
  Tier,
  type Policy,
  type Proposal,
  type VaultView,
} from '@skur/sdk';

export const ME = `0x${'11'.repeat(32)}`;
export const OTHER = `0x${'22'.repeat(32)}`;
export const BOB = `0x${'33'.repeat(32)}`;
export const SUI = '0x2::sui::SUI';
export const VAULT = `0x${'ab'.repeat(32)}`;

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const policy: Policy = {
  approvalsLow: 1,
  approvalsHigh: 2,
  approvalsCritical: 3,
  governanceThreshold: 2,
  guardianThreshold: 1,
  guardianRequiredCritical: true,
  delayHigh: HOUR,
  delayCritical: DAY,
  recipientActivationDelay: 12 * HOUR,
  policyChangeDelay: 2 * DAY,
  recoveryDelay: 3 * DAY,
  proposalTtl: 30 * DAY,
  highExposureBps: 1_000,
  criticalExposureBps: 2_500,
  hardBlockExposureBps: 9_000,
  envelopeBps: 3_000,
  envelopeWindow: DAY,
};

export function proposal(over: Partial<Proposal> = {}): Proposal {
  const now = Date.now();
  return {
    id: 1n,
    kind: Kind.TRANSFER,
    status: Status.PENDING,
    proposer: ME,
    createdAt: now - HOUR,
    executableAt: now - 1_000, // executable by default; tests override to test the timelock
    expiresAt: now + 10 * DAY,
    reqApprovals: 2,
    reqGuardians: 0,
    tier: Tier.HIGH,
    reasons: 1,
    exposureBps: 500,
    policyVersion: 1n,
    reductionMask: 0,
    approvals: [],
    confirmations: [],
    rejections: [],
    asset: SUI,
    amount: 5_000_000_000n,
    recipient: BOB,
    memo: 'invoice 1182',
    newPolicy: null,
    newLimits: null,
    member: `0x${'00'.repeat(32)}`,
    memberPrev: `0x${'00'.repeat(32)}`,
    memberRoles: 0,
    trustLevel: 0,
    targetMode: 0,
    ...over,
  };
}

/** A vault where the device's key holds exactly `roles`. */
export function view(roles: number, over: Partial<VaultView> = {}): VaultView {
  return {
    vault: {
      id: VAULT,
      name: 'Skur Demo Treasury',
      policy,
      policyVersion: 1n,
      mode: Mode.NORMAL,
      postureReasons: 0,
      ownerCount: 2,
      approverCount: 3,
      executorCount: 2,
      guardianCount: 1,
      nextProposal: 2n,
      pendingCount: 1,
      createdAt: Date.now() - 30 * DAY,
      tables: { members: '0x1', limits: '0x2', funds: '0x3', velocity: '0x4', recipients: '0x5', proposals: '0x6' },
      sizes: { members: 3, limits: 1, funds: 1, velocity: 1, recipients: 1, proposals: 1 },
      ...over.vault,
    },
    members: [
      { address: ME, roles },
      { address: OTHER, roles: Role.OWNER | Role.APPROVER | Role.EXECUTOR },
    ],
    assets: [
      {
        coinType: SUI,
        limits: {
          approved: true,
          lowMax: 1_000_000_000n,
          highMax: 10_000_000_000n,
          perTxMax: 50_000_000_000n,
          dailyMax: 100_000_000_000n,
        },
        balance: 1_000_000_000_000n,
        velocity: { dayAnchor: Date.now(), daySpent: 0n, envelopeAnchor: Date.now(), envelopeSpent: 0n, envelopeBasis: 1_000_000_000_000n },
      },
    ],
    recipients: [
      { address: BOB, trust: 2, registeredAt: Date.now() - DAY, activatesAt: Date.now() - HOUR, paidCount: 3, lastPaid: Date.now() - HOUR, label: 'Payroll' },
    ],
    proposals: [proposal()],
    ...over,
  };
}
