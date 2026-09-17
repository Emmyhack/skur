import type { Policy } from "./types";

/** Policy editor field definitions, shared by the web and mobile editors. */
export const H = 3600;
export type Unit = "count" | "hours" | "bps" | "bool";
export type PolicyField = { key: keyof Policy; label: string; hint: string; unit: Unit; max?: number };

export const POLICY_GROUPS: Array<{ title: string; sub: string; fields: PolicyField[] }> = [
  {
    title: "Approvals",
    sub: "How many confirmations each tier needs. Guardians confirm critical transfers in addition to approvers.",
    fields: [
      { key: "approvalsLow", label: "Low tier", hint: "Routine payments under the routine threshold.", unit: "count" },
      { key: "approvalsHigh", label: "High tier", hint: "Larger payments, new recipients, elevated posture.", unit: "count" },
      { key: "approvalsCritical", label: "Critical tier", hint: "Very large or high-exposure payments.", unit: "count" },
      { key: "guardianRequiredCritical", label: "Guardian required for Critical", hint: "An independent sign-off on the largest transfers.", unit: "bool" },
      { key: "guardianThreshold", label: "Guardian confirmations", hint: "For critical transfers, leaving Lockdown and recovery.", unit: "count" },
      { key: "governanceThreshold", label: "Owner approvals for governance", hint: "Policy, limits, members, trust, mode changes.", unit: "count" },
    ],
  },
  {
    title: "Delays",
    sub: "A delay gives guardians a veto window and gives the organisation time to notice.",
    fields: [
      { key: "delayHigh", label: "High-tier delay", hint: "Between full approval and execution.", unit: "hours" },
      { key: "delayCritical", label: "Critical delay", hint: "Also the guardian veto window.", unit: "hours" },
      { key: "recipientActivationDelay", label: "New-recipient activation", hint: "A never-seen address cannot be paid sooner.", unit: "hours" },
      { key: "policyChangeDelay", label: "Security-reducing change delay", hint: "Any loosening waits this long and can be vetoed.", unit: "hours" },
      { key: "recoveryDelay", label: "Recovery delay", hint: "Owners can cancel a recovery during it.", unit: "hours" },
      { key: "proposalTtl", label: "Proposal lifetime", hint: "Must exceed the longest delay by at least 1h.", unit: "hours" },
    ],
  },
  {
    title: "Exposure",
    sub: "Share of the asset's holdings that a single payment may move before it is escalated or refused.",
    fields: [
      { key: "highExposureBps", label: "Escalate to High at", hint: "Percent of holdings.", unit: "bps", max: 100 },
      { key: "criticalExposureBps", label: "Escalate to Critical at", hint: "", unit: "bps", max: 100 },
      { key: "hardBlockExposureBps", label: "Refuse above", hint: "0 disables the hard block.", unit: "bps", max: 100 },
    ],
  },
  {
    title: "Circuit breaker",
    sub: "Cumulative outflow per window as a share of holdings. The transfer that would exceed it is not paid; the vault enters Lockdown.",
    fields: [
      { key: "envelopeBps", label: "Loss envelope", hint: "0 disables the breaker.", unit: "bps", max: 100 },
      { key: "envelopeWindow", label: "Envelope window", hint: "At least 1 hour.", unit: "hours" },
    ],
  },
];

