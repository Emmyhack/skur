import { DAY, HOUR, type AssetLimits, type Policy } from '../types.js';

/**
 * Starting policies, one per kind of organization. Nobody designs seventeen fields from first
 * principles; they pick the closest fit and tighten from there, which is why every template is a
 * complete and valid policy rather than a partial preset.
 *
 * Amounts assume a 6-decimal stablecoin (USDC on Sui) and 9-decimal SUI.
 */
export const USDC = 1_000_000n;
export const SUI = 1_000_000_000n;

export type TemplateId =
  | 'startup'
  | 'team'
  | 'protocol'
  | 'fund'
  | 'payments'
  | 'nonprofit'
  | 'familyOffice';

export type Template = {
  id: TemplateId;
  name: string;
  tagline: string;
  /** Who this is for, in the words that organization would use. */
  audience: string;
  minSigners: number;
  minGuardians: number;
  policy: Policy;
  stable: AssetLimits;
  native: AssetLimits;
};

const startupPolicy: Policy = {
  approvalsLow: 1,
  approvalsHigh: 2,
  approvalsCritical: 2,
  governanceThreshold: 2,
  guardianThreshold: 1,
  guardianRequiredCritical: true,
  delayHigh: 6 * HOUR,
  delayCritical: 24 * HOUR,
  recipientActivationDelay: 24 * HOUR,
  policyChangeDelay: 24 * HOUR,
  recoveryDelay: 48 * HOUR,
  proposalTtl: 7 * DAY,
  highExposureBps: 500,
  criticalExposureBps: 2_000,
  hardBlockExposureBps: 5_000,
  envelopeBps: 1_000,
  envelopeWindow: 24 * HOUR,
};

const startupStable: AssetLimits = {
  approved: true,
  lowMax: 5_000n * USDC,
  highMax: 25_000n * USDC,
  perTxMax: 100_000n * USDC,
  dailyMax: 100_000n * USDC,
};

const startupNative: AssetLimits = {
  approved: true,
  lowMax: 100n * SUI,
  highMax: 1_000n * SUI,
  perTxMax: 0n,
  dailyMax: 5_000n * SUI,
};

export const TEMPLATES: Template[] = [
  {
    id: 'startup',
    name: 'Startup',
    tagline: 'Simple thresholds, a new-recipient delay, one guardian.',
    audience: 'A small team paying contractors and vendors out of a seed round.',
    minSigners: 2,
    minGuardians: 1,
    policy: startupPolicy,
    stable: startupStable,
    native: startupNative,
  },
  {
    id: 'team',
    name: 'Operating team',
    tagline: 'Tiered approvals, velocity limits, supplier trust.',
    audience: 'A company with a finance function and recurring suppliers.',
    minSigners: 3,
    minGuardians: 1,
    policy: { ...startupPolicy, approvalsCritical: 3, delayHigh: 4 * HOUR, envelopeBps: 500 },
    stable: {
      ...startupStable,
      lowMax: 10_000n * USDC,
      highMax: 50_000n * USDC,
      perTxMax: 150_000n * USDC,
      dailyMax: 150_000n * USDC,
    },
    native: startupNative,
  },
  {
    id: 'protocol',
    name: 'Protocol / DAO',
    tagline: 'Higher quorum, long timelocks, two guardians.',
    audience: 'A protocol treasury answerable to tokenholders, where every move is public.',
    minSigners: 4,
    minGuardians: 2,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 3,
      approvalsCritical: 4,
      governanceThreshold: 3,
      guardianThreshold: 2,
      delayHigh: 24 * HOUR,
      delayCritical: 72 * HOUR,
      policyChangeDelay: 72 * HOUR,
      recoveryDelay: 7 * DAY,
      proposalTtl: 14 * DAY,
      highExposureBps: 200,
      criticalExposureBps: 1_000,
      hardBlockExposureBps: 2_500,
      envelopeBps: 500,
    },
    stable: {
      ...startupStable,
      lowMax: 25_000n * USDC,
      highMax: 100_000n * USDC,
      perTxMax: 500_000n * USDC,
      dailyMax: 500_000n * USDC,
    },
    native: { ...startupNative, lowMax: 1_000n * SUI, highMax: 10_000n * SUI, dailyMax: 50_000n * SUI },
  },
  {
    id: 'fund',
    name: 'Fund',
    tagline: 'Tight exposure limits, strong guardians, long critical delays.',
    audience: 'A fund managing outside capital, where a single bad transfer is existential.',
    minSigners: 3,
    minGuardians: 2,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 3,
      approvalsCritical: 3,
      guardianThreshold: 2,
      delayHigh: 12 * HOUR,
      delayCritical: 72 * HOUR,
      recipientActivationDelay: 48 * HOUR,
      policyChangeDelay: 72 * HOUR,
      recoveryDelay: 7 * DAY,
      proposalTtl: 14 * DAY,
      highExposureBps: 100,
      criticalExposureBps: 500,
      hardBlockExposureBps: 2_000,
      envelopeBps: 300,
    },
    stable: {
      ...startupStable,
      lowMax: 50_000n * USDC,
      highMax: 250_000n * USDC,
      perTxMax: 1_000_000n * USDC,
      dailyMax: 1_000_000n * USDC,
    },
    native: { ...startupNative, lowMax: 1_000n * SUI, highMax: 10_000n * SUI, dailyMax: 50_000n * SUI },
  },
  {
    id: 'payments',
    name: 'Payments company',
    tagline: 'High routine throughput, a tight envelope, an agent proposer.',
    audience:
      'A business paying many small amounts automatically, where volume is normal and a spike is not.',
    minSigners: 3,
    minGuardians: 1,
    policy: {
      ...startupPolicy,
      approvalsLow: 1,
      approvalsHigh: 2,
      approvalsCritical: 3,
      delayHigh: 1 * HOUR,
      delayCritical: 12 * HOUR,
      recipientActivationDelay: 6 * HOUR,
      policyChangeDelay: 48 * HOUR,
      proposalTtl: 3 * DAY,
      highExposureBps: 100,
      criticalExposureBps: 500,
      hardBlockExposureBps: 1_500,
      // The envelope, not the per-payment caps, is what defends a high-volume treasury.
      envelopeBps: 200,
      envelopeWindow: 6 * HOUR,
    },
    stable: {
      ...startupStable,
      lowMax: 2_500n * USDC,
      highMax: 25_000n * USDC,
      perTxMax: 25_000n * USDC,
      dailyMax: 500_000n * USDC,
    },
    native: startupNative,
  },
  {
    id: 'nonprofit',
    name: 'Nonprofit',
    tagline: 'Restricted recipients, separation of duties, a full audit trail.',
    audience: 'An organization spending donated money that has to account for all of it.',
    minSigners: 3,
    minGuardians: 1,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 2,
      approvalsCritical: 3,
      recipientActivationDelay: 72 * HOUR,
      delayHigh: 12 * HOUR,
      delayCritical: 48 * HOUR,
      envelopeBps: 500,
    },
    stable: startupStable,
    native: startupNative,
  },
  {
    id: 'familyOffice',
    name: 'Family office',
    tagline: 'Conservative limits, a cold guardian, a long recovery path.',
    audience: 'Long-term holdings that move rarely, where availability matters less than safety.',
    minSigners: 2,
    minGuardians: 1,
    policy: {
      ...startupPolicy,
      delayHigh: 24 * HOUR,
      delayCritical: 72 * HOUR,
      recipientActivationDelay: 72 * HOUR,
      policyChangeDelay: 72 * HOUR,
      recoveryDelay: 14 * DAY,
      proposalTtl: 21 * DAY,
      highExposureBps: 100,
      criticalExposureBps: 500,
      hardBlockExposureBps: 1_500,
      envelopeBps: 200,
    },
    stable: {
      ...startupStable,
      lowMax: 10_000n * USDC,
      highMax: 50_000n * USDC,
      perTxMax: 250_000n * USDC,
      dailyMax: 250_000n * USDC,
    },
    native: startupNative,
  },
];

export function templateById(id: TemplateId): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown template ${id}`);
  return t;
}
