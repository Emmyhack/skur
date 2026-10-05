/**
 * The vocabulary, kept identical to `sui/sources/types.move`. Anything that disagrees with the
 * chain is a bug in this file, not in the contract.
 *
 * Durations are milliseconds everywhere, because that is what `sui::clock` reports. Amounts are
 * `bigint` in the smallest unit of their coin type.
 */

export const Role = {
  OWNER: 1,
  APPROVER: 2,
  EXECUTOR: 4,
  GUARDIAN: 8,
  /** An automated agent: may open proposals and nothing else. */
  PROPOSER: 16,
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_TREASURY_MASK = Role.OWNER | Role.APPROVER | Role.EXECUTOR | Role.PROPOSER;
export const ROLE_ALL = 31;

export const ROLE_LABELS: Record<number, string> = {
  [Role.OWNER]: 'Owner',
  [Role.APPROVER]: 'Approver',
  [Role.EXECUTOR]: 'Executor',
  [Role.GUARDIAN]: 'Guardian',
  [Role.PROPOSER]: 'Proposer',
};

export function hasRole(bits: number, role: Role | number): boolean {
  return (bits & role) === role;
}

export function hasAnyRole(bits: number, mask: number): boolean {
  return (bits & mask) !== 0;
}

export function canPropose(bits: number): boolean {
  return hasAnyRole(bits, ROLE_TREASURY_MASK);
}

/** A guardian is the second control plane and may hold no treasury role. */
export function rolesValid(bits: number): boolean {
  if (bits === 0 || bits > ROLE_ALL) return false;
  if (hasRole(bits, Role.GUARDIAN) && (bits & ROLE_TREASURY_MASK) !== 0) return false;
  return true;
}

export function describeRoles(bits: number): string[] {
  return Object.values(Role)
    .filter((r) => hasRole(bits, r))
    .map((r) => ROLE_LABELS[r]);
}

export const Tier = { LOW: 0, HIGH: 1, CRITICAL: 2 } as const;
export type Tier = (typeof Tier)[keyof typeof Tier];
export const TIER_LABELS: Record<Tier, string> = {
  [Tier.LOW]: 'Routine',
  [Tier.HIGH]: 'High risk',
  [Tier.CRITICAL]: 'Critical',
};

export const Trust = {
  UNKNOWN: 0,
  NEW: 1,
  VERIFIED: 2,
  TRUSTED: 3,
  RESTRICTED: 4,
  BLOCKED: 5,
} as const;
export type Trust = (typeof Trust)[keyof typeof Trust];
export const TRUST_LABELS: Record<Trust, string> = {
  [Trust.UNKNOWN]: 'Never paid',
  [Trust.NEW]: 'New',
  [Trust.VERIFIED]: 'Verified',
  [Trust.TRUSTED]: 'Trusted',
  [Trust.RESTRICTED]: 'Restricted',
  [Trust.BLOCKED]: 'Blocked',
};

export const Mode = { NORMAL: 0, ELEVATED: 1, LOCKDOWN: 2 } as const;
export type Mode = (typeof Mode)[keyof typeof Mode];
export const MODE_LABELS: Record<Mode, string> = {
  [Mode.NORMAL]: 'Normal',
  [Mode.ELEVATED]: 'Elevated',
  [Mode.LOCKDOWN]: 'Lockdown',
};

export const Kind = {
  TRANSFER: 0,
  POLICY_UPDATE: 1,
  ASSET_LIMITS: 2,
  MEMBER_SET: 3,
  RECIPIENT_TRUST: 4,
  MODE_RELAX: 5,
  RECOVERY: 6,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];
export const KIND_LABELS: Record<Kind, string> = {
  [Kind.TRANSFER]: 'Payment',
  [Kind.POLICY_UPDATE]: 'Policy change',
  [Kind.ASSET_LIMITS]: 'Asset limits',
  [Kind.MEMBER_SET]: 'Signer change',
  [Kind.RECIPIENT_TRUST]: 'Recipient trust',
  [Kind.MODE_RELAX]: 'Lower security mode',
  [Kind.RECOVERY]: 'Signer recovery',
};

export const Status = {
  NONE: 0,
  PENDING: 1,
  EXECUTED: 2,
  CANCELLED: 3,
  VETOED: 4,
  EXPIRED: 5,
  /** Refused by the circuit breaker. The vault latched into Lockdown instead of paying. */
  BLOCKED: 6,
  /** Turned down by the signers: as many rejections as it needed approvals. */
  REJECTED: 7,
} as const;
export type Status = (typeof Status)[keyof typeof Status];
export const STATUS_LABELS: Record<Status, string> = {
  [Status.NONE]: 'Unknown',
  [Status.PENDING]: 'Awaiting approval',
  [Status.EXECUTED]: 'Executed',
  [Status.CANCELLED]: 'Cancelled',
  [Status.VETOED]: 'Vetoed',
  [Status.EXPIRED]: 'Expired',
  [Status.BLOCKED]: 'Refused by the circuit breaker',
  [Status.REJECTED]: 'Rejected',
};

export const Reason = {
  AMOUNT_HIGH: 1,
  AMOUNT_CRITICAL: 2,
  EXPOSURE_HIGH: 4,
  EXPOSURE_CRITICAL: 8,
  RECIPIENT_PROBATION: 16,
  RECIPIENT_RESTRICTED: 32,
  MODE_ELEVATED: 64,
  VELOCITY_PRESSURE: 128,
  RECIPIENT_UNKNOWN: 256,
  ENVELOPE_PRESSURE: 512,
} as const;
export type Reason = (typeof Reason)[keyof typeof Reason];

/** Plain-language explanations, in the order a reviewer should read them. */
export const REASON_TEXT: [Reason, string][] = [
  [Reason.AMOUNT_CRITICAL, 'Above the high-tier maximum for this asset'],
  [Reason.AMOUNT_HIGH, 'Above the routine maximum for this asset'],
  [Reason.EXPOSURE_CRITICAL, 'A critical share of what the vault holds'],
  [Reason.EXPOSURE_HIGH, 'A large share of what the vault holds'],
  [Reason.RECIPIENT_RESTRICTED, 'The recipient is restricted'],
  [Reason.RECIPIENT_UNKNOWN, 'The vault has never paid this address'],
  [Reason.RECIPIENT_PROBATION, 'The recipient is still in its activation delay'],
  [Reason.VELOCITY_PRESSURE, "Past half of today's allowance for this asset"],
  [Reason.ENVELOPE_PRESSURE, 'Against the loss envelope for the window'],
  [Reason.MODE_ELEVATED, 'The vault is in Elevated mode'],
];

export function describeReasons(mask: number): string[] {
  return REASON_TEXT.filter(([bit]) => (mask & bit) !== 0).map(([, text]) => text);
}

export const BPS = 10_000n;
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** The seventeen fields. Durations in milliseconds, exposures in basis points. */
export type Policy = {
  approvalsLow: number;
  approvalsHigh: number;
  approvalsCritical: number;
  governanceThreshold: number;
  guardianThreshold: number;
  guardianRequiredCritical: boolean;
  delayHigh: number;
  delayCritical: number;
  recipientActivationDelay: number;
  policyChangeDelay: number;
  recoveryDelay: number;
  proposalTtl: number;
  highExposureBps: number;
  criticalExposureBps: number;
  hardBlockExposureBps: number;
  envelopeBps: number;
  envelopeWindow: number;
};

export type AssetLimits = {
  approved: boolean;
  lowMax: bigint;
  highMax: bigint;
  perTxMax: bigint;
  dailyMax: bigint;
};

export type Velocity = {
  dayAnchor: number;
  daySpent: bigint;
  envelopeAnchor: number;
  envelopeSpent: bigint;
  /** The balance when the window opened; the envelope is measured against this, not the live
   * balance, so a drain cannot shrink its own denominator. */
  envelopeBasis: bigint;
};

export type RecipientRecord = {
  address: string;
  trust: Trust;
  registeredAt: number;
  activatesAt: number;
  paidCount: number;
  lastPaid: number;
  label: string;
};

export type Proposal = {
  id: bigint;
  kind: Kind;
  status: Status;
  proposer: string;
  createdAt: number;
  executableAt: number;
  expiresAt: number;
  reqApprovals: number;
  reqGuardians: number;
  tier: Tier;
  reasons: number;
  exposureBps: number;
  policyVersion: bigint;
  reductionMask: number;
  approvals: string[];
  confirmations: string[];
  rejections: string[];
  asset: string | null;
  amount: bigint;
  recipient: string;
  memo: string;
  newPolicy: Policy | null;
  newLimits: AssetLimits | null;
  member: string;
  memberPrev: string;
  memberRoles: number;
  trustLevel: Trust;
  targetMode: Mode;
};

export type VaultSummary = {
  id: string;
  name: string;
  policy: Policy;
  policyVersion: bigint;
  mode: Mode;
  postureReasons: number;
  ownerCount: number;
  approverCount: number;
  executorCount: number;
  guardianCount: number;
  nextProposal: bigint;
  pendingCount: number;
  createdAt: number;
  /** Table and Bag object ids, needed to read the collections by dynamic field. */
  tables: {
    members: string;
    limits: string;
    funds: string;
    velocity: string;
    recipients: string;
    proposals: string;
  };
  sizes: {
    members: number;
    limits: number;
    funds: number;
    velocity: number;
    recipients: number;
    proposals: number;
  };
};

/** What `preview_transfer` returns, in order. */
export type TransferPreview = {
  tier: Tier;
  reasons: number;
  exposureBps: number;
  reqApprovals: number;
  reqGuardians: number;
  delay: number;
};
