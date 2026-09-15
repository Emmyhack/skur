/** Mirrors contracts/src/SkurTypes.sol. Keep in sync; the contract is authoritative. */

export const ROLE_OWNER = 1;
export const ROLE_APPROVER = 2;
export const ROLE_EXECUTOR = 4;
export const ROLE_GUARDIAN = 8;
export const ROLE_TREASURY_MASK = ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR;

export const BPS = 10_000n;

export const REASON_AMOUNT_HIGH = 1 << 0;
export const REASON_AMOUNT_CRITICAL = 1 << 1;
export const REASON_EXPOSURE_HIGH = 1 << 2;
export const REASON_EXPOSURE_CRITICAL = 1 << 3;
export const REASON_RECIPIENT_PROBATION = 1 << 4;
export const REASON_RECIPIENT_RESTRICTED = 1 << 5;
export const REASON_MODE_ELEVATED = 1 << 6;
export const REASON_VELOCITY_PRESSURE = 1 << 7;
export const REASON_RECIPIENT_UNKNOWN = 1 << 8;

export enum Mode {
  NORMAL = 0,
  ELEVATED = 1,
  LOCKDOWN = 2,
}

export enum Tier {
  LOW = 0,
  HIGH = 1,
  CRITICAL = 2,
}

export enum Trust {
  UNKNOWN = 0,
  NEW = 1,
  VERIFIED = 2,
  TRUSTED = 3,
  RESTRICTED = 4,
  BLOCKED = 5,
}

export enum Kind {
  TRANSFER = 0,
  POLICY_UPDATE = 1,
  ASSET_LIMITS = 2,
  MEMBER_SET = 3,
  RECIPIENT_TRUST = 4,
  MODE_RELAX = 5,
  RECOVERY = 6,
}

export enum Status {
  NONE = 0,
  PENDING = 1,
  EXECUTED = 2,
  CANCELLED = 3,
  VETOED = 4,
}

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

export type Recipient = {
  trust: Trust;
  registeredAt: bigint;
  activatesAt: bigint;
  paymentCount: bigint;
  totalPaid: bigint;
};

export type Proposal = {
  kind: Kind;
  status: Status;
  tier: Tier;
  requiredApprovals: number;
  requiredGuardians: number;
  securityReducing: boolean;
  riskReasons: number;
  policyVersion: number;
  proposer: `0x${string}`;
  asset: `0x${string}`;
  target: `0x${string}`;
  amount: bigint;
  createdAt: bigint;
  executableAfter: bigint;
  expiresAt: bigint;
  data: `0x${string}`;
};

export type AssetMeta = {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  limits: AssetLimits;
  balance: bigint;
};

export const MODE_LABEL: Record<Mode, string> = {
  [Mode.NORMAL]: "Normal",
  [Mode.ELEVATED]: "Elevated",
  [Mode.LOCKDOWN]: "Lockdown",
};

export const TIER_LABEL: Record<Tier, string> = {
  [Tier.LOW]: "Low",
  [Tier.HIGH]: "High",
  [Tier.CRITICAL]: "Critical",
};

export const TRUST_LABEL: Record<Trust, string> = {
  [Trust.UNKNOWN]: "Unknown",
  [Trust.NEW]: "New",
  [Trust.VERIFIED]: "Verified",
  [Trust.TRUSTED]: "Trusted",
  [Trust.RESTRICTED]: "Restricted",
  [Trust.BLOCKED]: "Blocked",
};

export const KIND_LABEL: Record<Kind, string> = {
  [Kind.TRANSFER]: "Transfer",
  [Kind.POLICY_UPDATE]: "Policy update",
  [Kind.ASSET_LIMITS]: "Asset limits",
  [Kind.MEMBER_SET]: "Membership change",
  [Kind.RECIPIENT_TRUST]: "Recipient trust",
  [Kind.MODE_RELAX]: "Lower security mode",
  [Kind.RECOVERY]: "Signer recovery",
};

export const STATUS_LABEL: Record<Status, string> = {
  [Status.NONE]: "None",
  [Status.PENDING]: "Pending",
  [Status.EXECUTED]: "Executed",
  [Status.CANCELLED]: "Cancelled",
  [Status.VETOED]: "Vetoed",
};

export function roleNames(bits: number): string[] {
  const out: string[] = [];
  if (bits & ROLE_OWNER) out.push("Owner");
  if (bits & ROLE_APPROVER) out.push("Approver");
  if (bits & ROLE_EXECUTOR) out.push("Executor");
  if (bits & ROLE_GUARDIAN) out.push("Guardian");
  return out;
}

export const REASON_TEXT: Array<[number, string]> = [
  [REASON_AMOUNT_CRITICAL, "the amount is above the critical threshold for this asset"],
  [REASON_AMOUNT_HIGH, "the amount is above the routine threshold for this asset"],
  [REASON_EXPOSURE_CRITICAL, "it would move a critical share of the vault's holdings"],
  [REASON_EXPOSURE_HIGH, "it would move a significant share of the vault's holdings"],
  [REASON_RECIPIENT_RESTRICTED, "the recipient is restricted by policy"],
  [REASON_RECIPIENT_UNKNOWN, "this vault has never paid the recipient before"],
  [REASON_RECIPIENT_PROBATION, "the recipient is still within its activation delay"],
  [REASON_VELOCITY_PRESSURE, "more than half of today's daily cap would be used"],
  [REASON_MODE_ELEVATED, "the vault is in Elevated mode"],
];

export function explainReasons(mask: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [bit, text] of REASON_TEXT) {
    if (mask & bit && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}
