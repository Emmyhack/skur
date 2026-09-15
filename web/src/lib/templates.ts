import type { AssetLimits, Policy } from "./types";

/** Mirror of contracts/script/SkurTemplates.sol. Amounts assume a 6-decimal stablecoin and 18-decimal KASH. */
const H = 3600;
const D = 86400;
export const USD = 1_000_000n;
export const KASH = 10n ** 18n;

export type TemplateId = "startup" | "sme" | "dao" | "fund" | "nonprofit" | "familyOffice";

export type Template = {
  id: TemplateId;
  name: string;
  tagline: string;
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
  delayHigh: 6 * H,
  delayCritical: 24 * H,
  recipientActivationDelay: 24 * H,
  policyChangeDelay: 24 * H,
  recoveryDelay: 48 * H,
  proposalTtl: 7 * D,
  highExposureBps: 500,
  criticalExposureBps: 2000,
  hardBlockExposureBps: 5000,
  envelopeBps: 1000,
  envelopeWindow: 24 * H,
};

const startupStable: AssetLimits = {
  approved: true,
  lowMax: 5_000n * USD,
  highMax: 25_000n * USD,
  perTxMax: 100_000n * USD,
  dailyMax: 100_000n * USD,
};

const startupNative: AssetLimits = {
  approved: true,
  lowMax: 100n * KASH,
  highMax: 1_000n * KASH,
  perTxMax: 0n,
  dailyMax: 5_000n * KASH,
};

export const TEMPLATES: Template[] = [
  {
    id: "startup",
    name: "Startup",
    tagline: "Simple thresholds, new-recipient delay, one guardian.",
    minSigners: 2,
    minGuardians: 1,
    policy: startupPolicy,
    stable: startupStable,
    native: startupNative,
  },
  {
    id: "sme",
    name: "SME",
    tagline: "Tiered approvals, velocity limits, supplier trust.",
    minSigners: 3,
    minGuardians: 1,
    policy: { ...startupPolicy, approvalsCritical: 3, delayHigh: 4 * H, envelopeBps: 500 },
    stable: { ...startupStable, lowMax: 10_000n * USD, highMax: 50_000n * USD, perTxMax: 150_000n * USD, dailyMax: 150_000n * USD },
    native: startupNative,
  },
  {
    id: "dao",
    name: "Protocol / DAO",
    tagline: "Higher quorum, contract-call controls, timelocks.",
    minSigners: 4,
    minGuardians: 2,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 3,
      approvalsCritical: 4,
      governanceThreshold: 3,
      guardianThreshold: 2,
      delayHigh: 24 * H,
      delayCritical: 72 * H,
      policyChangeDelay: 72 * H,
      recoveryDelay: 7 * D,
      proposalTtl: 14 * D,
      highExposureBps: 200,
      criticalExposureBps: 1000,
      hardBlockExposureBps: 2500,
      envelopeBps: 500,
    },
    stable: { ...startupStable, lowMax: 25_000n * USD, highMax: 100_000n * USD, perTxMax: 500_000n * USD, dailyMax: 500_000n * USD },
    native: { ...startupNative, lowMax: 1_000n * KASH, highMax: 10_000n * KASH, dailyMax: 50_000n * KASH },
  },
  {
    id: "fund",
    name: "Fund",
    tagline: "Exposure limits, strong guardians, long critical delays.",
    minSigners: 3,
    minGuardians: 2,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 3,
      approvalsCritical: 3,
      guardianThreshold: 2,
      delayHigh: 12 * H,
      delayCritical: 72 * H,
      recipientActivationDelay: 48 * H,
      policyChangeDelay: 72 * H,
      recoveryDelay: 7 * D,
      proposalTtl: 14 * D,
      highExposureBps: 100,
      criticalExposureBps: 500,
      hardBlockExposureBps: 2000,
      envelopeBps: 300,
    },
    stable: { ...startupStable, lowMax: 50_000n * USD, highMax: 250_000n * USD, perTxMax: 1_000_000n * USD, dailyMax: 1_000_000n * USD },
    native: { ...startupNative, lowMax: 1_000n * KASH, highMax: 10_000n * KASH, dailyMax: 50_000n * KASH },
  },
  {
    id: "nonprofit",
    name: "Nonprofit",
    tagline: "Restricted recipients, approval separation, auditability.",
    minSigners: 3,
    minGuardians: 1,
    policy: {
      ...startupPolicy,
      approvalsLow: 2,
      approvalsHigh: 2,
      approvalsCritical: 3,
      recipientActivationDelay: 72 * H,
      delayHigh: 12 * H,
      delayCritical: 48 * H,
      envelopeBps: 500,
    },
    stable: startupStable,
    native: startupNative,
  },
  {
    id: "familyOffice",
    name: "Family Office",
    tagline: "Conservative limits, cold guardian, recovery policy.",
    minSigners: 2,
    minGuardians: 1,
    policy: {
      ...startupPolicy,
      delayHigh: 24 * H,
      delayCritical: 72 * H,
      recipientActivationDelay: 72 * H,
      policyChangeDelay: 72 * H,
      recoveryDelay: 14 * D,
      proposalTtl: 21 * D,
      highExposureBps: 100,
      criticalExposureBps: 500,
      hardBlockExposureBps: 1500,
      envelopeBps: 200,
    },
    stable: { ...startupStable, lowMax: 10_000n * USD, highMax: 50_000n * USD, perTxMax: 250_000n * USD, dailyMax: 250_000n * USD },
    native: startupNative,
  },
];

export function templateById(id: TemplateId): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown template ${id}`);
  return t;
}
