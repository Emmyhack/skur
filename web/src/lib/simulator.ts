import { classify, effectiveCaps, requirements } from "./risk";
import { Mode, Tier, Trust, type AssetLimits, type Policy } from "./types";
import { fmtDuration } from "./format";

/**
 * Policy simulator: runs a configured policy against the blueprint's attack scenarios before it is
 * activated. Everything here is the deterministic risk engine plus the vault's limit checks; nothing is
 * heuristic. Verdicts describe what the contract would do, in business language.
 */
export type Verdict = "blocked" | "delayed" | "escalated" | "allowed" | "impossible";

export type ScenarioResult = {
  id: string;
  title: string;
  narrative: string;
  verdict: Verdict;
  detail: string[];
};

export type SimContext = {
  policy: Policy;
  limits: AssetLimits;
  balance: bigint;
  decimals: number;
  symbol: string;
  approverCount: number;
  guardianCount: number;
};

function fmt(v: bigint, ctx: SimContext): string {
  const s = Number(v) / 10 ** ctx.decimals;
  return `${s.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${ctx.symbol}`;
}

function single(ctx: SimContext, amount: bigint, trust: Trust, inProbation: boolean, mode: Mode, compromised: number) {
  const caps = effectiveCaps(ctx.limits.perTxMax, ctx.limits.dailyMax, mode);
  const detail: string[] = [];
  if (mode === Mode.LOCKDOWN) return { verdict: "blocked" as Verdict, detail: ["Vault is in Lockdown: no outgoing execution."] };
  if (trust === Trust.BLOCKED) return { verdict: "blocked" as Verdict, detail: ["Recipient is blocked."] };
  if (caps.perTxMax !== 0n && amount > caps.perTxMax) {
    return { verdict: "blocked" as Verdict, detail: [`Per-transaction cap is ${fmt(caps.perTxMax, ctx)}; the proposal is refused at creation.`] };
  }
  const r = classify({
    amount,
    assetBalance: ctx.balance,
    lowMax: ctx.limits.lowMax,
    highMax: ctx.limits.highMax,
    dailyMax: caps.dailyMax,
    daySpent: 0n,
    trust,
    inProbation,
    mode,
    highExposureBps: ctx.policy.highExposureBps,
    criticalExposureBps: ctx.policy.criticalExposureBps,
  });
  if (ctx.policy.hardBlockExposureBps !== 0 && r.exposureBps > ctx.policy.hardBlockExposureBps) {
    return { verdict: "blocked" as Verdict, detail: [`Exposure ${(r.exposureBps / 100).toFixed(1)}% exceeds the hard block of ${ctx.policy.hardBlockExposureBps / 100}%.`] };
  }
  if (caps.dailyMax !== 0n && amount > caps.dailyMax) {
    return { verdict: "blocked" as Verdict, detail: [`Daily cap is ${fmt(caps.dailyMax, ctx)}; execution would revert.`] };
  }
  const envelope = ctx.policy.envelopeBps === 0 ? 0n : (ctx.balance * BigInt(ctx.policy.envelopeBps)) / 10_000n;
  if (envelope !== 0n && amount > envelope) {
    return { verdict: "blocked" as Verdict, detail: [`Loss envelope is ${fmt(envelope, ctx)} per ${fmtDuration(ctx.policy.envelopeWindow)}; the circuit breaker trips and the vault enters Lockdown instead of paying.`] };
  }
  const req = requirements(ctx.policy, r.tier);
  detail.push(`Risk tier: ${Tier[r.tier]} (exposure ${(r.exposureBps / 100).toFixed(2)}%).`);
  detail.push(`Needs ${req.approvals} approval${req.approvals === 1 ? "" : "s"}${req.guardians ? ` and ${req.guardians} guardian confirmation${req.guardians === 1 ? "" : "s"}` : ""}${req.delay ? `, then waits ${fmtDuration(req.delay)}` : ", no delay"}.`);
  let delay = req.delay;
  if (inProbation) {
    delay = Math.max(delay, ctx.policy.recipientActivationDelay);
    detail.push(`Recipient activation delay forces a wait of at least ${fmtDuration(ctx.policy.recipientActivationDelay)}.`);
  }
  const vetoable = r.tier === Tier.CRITICAL || inProbation || mode !== Mode.NORMAL;
  if (vetoable) detail.push("Any guardian can veto before execution.");
  if (req.guardians > ctx.guardianCount) {
    return { verdict: "impossible" as Verdict, detail: [...detail, "More guardian confirmations are required than guardians exist."] };
  }
  if (compromised < req.approvals) {
    detail.push(`Attacker controls ${compromised} approver${compromised === 1 ? "" : "s"}, fewer than required.`);
    return { verdict: "blocked" as Verdict, detail };
  }
  if (req.guardians > 0) {
    detail.push("Guardian confirmation is an independent control the attacker does not hold.");
    return { verdict: "blocked" as Verdict, detail };
  }
  if (delay > 0) return { verdict: "delayed" as Verdict, detail };
  if (r.tier > Tier.LOW) return { verdict: "escalated" as Verdict, detail };
  return { verdict: "allowed" as Verdict, detail };
}

export function runScenarios(ctx: SimContext): ScenarioResult[] {
  const out: ScenarioResult[] = [];
  const pct = (bps: number) => (ctx.balance * BigInt(bps)) / 10_000n;
  const unit = 10n ** BigInt(ctx.decimals);

  // 1. Finance signer compromised, $100k to a new address
  {
    const amount = 100_000n * unit;
    const r = single(ctx, amount, Trust.UNKNOWN, true, Mode.NORMAL, 1);
    out.push({
      id: "single-signer-new-address",
      title: "One finance signer compromised",
      narrative: `Attacker with a single approver key proposes ${fmt(amount, ctx)} to a never-seen address.`,
      verdict: r.verdict,
      detail: r.detail,
    });
  }
  // 2. Three signers compromised, 40% of treasury
  {
    const amount = pct(4000);
    const r = single(ctx, amount, Trust.VERIFIED, false, Mode.NORMAL, 3);
    out.push({
      id: "three-signers-40pct",
      title: "Three signers compromised, 40% withdrawal",
      narrative: `Attacker with three approver keys proposes ${fmt(amount, ctx)} (40% of holdings) to a verified recipient.`,
      verdict: r.verdict,
      detail: r.detail,
    });
  }
  // 3. Split drain: 20 x 9,900
  {
    const each = 9_900n * unit;
    const total = each * 20n;
    const caps = effectiveCaps(ctx.limits.perTxMax, ctx.limits.dailyMax, Mode.NORMAL);
    const envelope = ctx.policy.envelopeBps === 0 ? 0n : pct(ctx.policy.envelopeBps);
    const detail: string[] = [];
    let verdict: Verdict = "allowed";
    const tierEach = classify({
      amount: each,
      assetBalance: ctx.balance,
      lowMax: ctx.limits.lowMax,
      highMax: ctx.limits.highMax,
      dailyMax: caps.dailyMax,
      daySpent: 0n,
      trust: Trust.VERIFIED,
      inProbation: false,
      mode: Mode.NORMAL,
      highExposureBps: ctx.policy.highExposureBps,
      criticalExposureBps: ctx.policy.criticalExposureBps,
    });
    detail.push(`Each transfer alone is ${Tier[tierEach.tier]} tier.`);
    if (caps.dailyMax !== 0n && total > caps.dailyMax) {
      const n = Number(caps.dailyMax / each);
      detail.push(`Daily cap ${fmt(caps.dailyMax, ctx)} stops execution after ${n} transfer${n === 1 ? "" : "s"} (${fmt(each * BigInt(n), ctx)}).`);
      verdict = "blocked";
    }
    if (envelope !== 0n && total > envelope) {
      const n = Number(envelope / each);
      detail.push(`Loss envelope ${fmt(envelope, ctx)} trips the circuit breaker after ${n} transfer${n === 1 ? "" : "s"}; the vault enters Lockdown.`);
      verdict = "blocked";
    }
    if (caps.dailyMax !== 0n && (each * 2n) > caps.dailyMax / 2n) {
      detail.push("Velocity pressure escalates later transfers to HIGH once half the daily cap is spent.");
      if (verdict === "allowed") verdict = "escalated";
    }
    if (verdict === "allowed") detail.push("No cumulative cap is configured: the split drain would succeed. Configure a daily cap or envelope.");
    out.push({
      id: "split-drain",
      title: "Drain split into twenty transfers",
      narrative: `Twenty transfers of ${fmt(each, ctx)} (${fmt(total, ctx)} total) within one day.`,
      verdict,
      detail,
    });
  }
  // 4. Attacker weakens policy then withdraws
  {
    const detail: string[] = [];
    detail.push(`Lowering any threshold, delay or cap is a security-reducing change: it waits ${fmtDuration(ctx.policy.policyChangeDelay)} and any guardian can veto it.`);
    detail.push(`It needs ${ctx.policy.governanceThreshold} owner approval${ctx.policy.governanceThreshold === 1 ? "" : "s"}, and cannot be created at all while the vault is in Lockdown.`);
    detail.push("Until it activates, in-flight proposals keep their pinned requirements.");
    const verdict: Verdict = ctx.policy.policyChangeDelay > 0 ? "delayed" : "allowed";
    if (verdict === "allowed") detail.push("Policy-change delay is 0: a compromised owner quorum could relax the policy immediately. Set a delay.");
    out.push({
      id: "policy-weaken",
      title: "Attacker weakens the policy, then withdraws",
      narrative: "A compromised owner quorum proposes lower approvals and caps before draining.",
      verdict,
      detail,
    });
  }
  // 5. Guardian compromised
  {
    out.push({
      id: "guardian-compromised",
      title: "Guardian key compromised",
      narrative: "Attacker holds a guardian key and tries to withdraw.",
      verdict: "impossible",
      detail: [
        "Guardians hold no treasury role: they cannot propose, approve or execute transfers, and cannot be given treasury roles.",
        `The worst a guardian can do is freeze the vault or propose a recovery that waits ${fmtDuration(ctx.policy.recoveryDelay)} and any owner can cancel.`,
      ],
    });
  }
  // 6. Elevated posture check: routine payment during an incident
  {
    const amount = ctx.limits.lowMax;
    const r = single(ctx, amount, Trust.VERIFIED, false, Mode.ELEVATED, 2);
    out.push({
      id: "elevated-routine",
      title: "Routine payment while Elevated",
      narrative: `During an incident the vault is Elevated; a ${fmt(amount, ctx)} routine payment is proposed.`,
      verdict: r.verdict,
      detail: r.detail,
    });
  }
  return out;
}
