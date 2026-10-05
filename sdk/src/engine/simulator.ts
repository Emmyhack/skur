import { Mode, TIER_LABELS, Tier, Trust, type AssetLimits, type Policy } from '../types.js';
import { classify, effectiveCaps, requirements } from './risk.js';
import { fmtDuration } from './format.js';

/**
 * Runs a policy against the attacks that actually happen, before the policy is live. Every verdict
 * is the deterministic risk engine plus the vault's own limit checks — nothing here is heuristic,
 * and nothing here is a score.
 */
export type Verdict = 'blocked' | 'delayed' | 'escalated' | 'allowed' | 'impossible';

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
  return `${s.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${ctx.symbol}`;
}

function single(
  ctx: SimContext,
  amount: bigint,
  trust: Trust,
  inProbation: boolean,
  mode: Mode,
  compromised: number,
): { verdict: Verdict; detail: string[] } {
  const caps = effectiveCaps(ctx.limits.perTxMax, ctx.limits.dailyMax, mode);
  const detail: string[] = [];
  if (mode === Mode.LOCKDOWN)
    return { verdict: 'blocked', detail: ['The vault is in Lockdown: nothing outgoing executes.'] };
  if (trust === Trust.BLOCKED) return { verdict: 'blocked', detail: ['The recipient is blocked.'] };
  if (caps.perTxMax !== 0n && amount > caps.perTxMax)
    return {
      verdict: 'blocked',
      detail: [
        `The per-transaction cap is ${fmt(caps.perTxMax, ctx)}, so the proposal is refused when it is opened.`,
      ],
    };

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

  if (ctx.policy.hardBlockExposureBps !== 0 && r.exposureBps >= ctx.policy.hardBlockExposureBps)
    return {
      verdict: 'blocked',
      detail: [
        `Exposure of ${(r.exposureBps / 100).toFixed(1)}% is at or above the hard block of ${ctx.policy.hardBlockExposureBps / 100}%, which no amount of approval can clear.`,
      ],
    };
  if (caps.dailyMax !== 0n && amount > caps.dailyMax)
    return {
      verdict: 'blocked',
      detail: [`The daily cap is ${fmt(caps.dailyMax, ctx)}, so this cannot be opened today.`],
    };

  const envelope =
    ctx.policy.envelopeBps === 0 ? 0n : (ctx.balance * BigInt(ctx.policy.envelopeBps)) / 10_000n;
  if (envelope !== 0n && amount > envelope)
    return {
      verdict: 'blocked',
      detail: [
        `The loss envelope is ${fmt(envelope, ctx)} per ${fmtDuration(ctx.policy.envelopeWindow)}. The breaker trips and the vault enters Lockdown instead of paying.`,
      ],
    };

  const req = requirements(ctx.policy, r.tier);
  detail.push(
    `Risk tier: ${TIER_LABELS[r.tier]}, at ${(r.exposureBps / 100).toFixed(2)}% of holdings.`,
  );
  detail.push(
    `Needs ${req.approvals} approval${req.approvals === 1 ? '' : 's'}${
      req.guardians
        ? ` and ${req.guardians} guardian confirmation${req.guardians === 1 ? '' : 's'}`
        : ''
    }${req.delay ? `, then waits ${fmtDuration(req.delay)}` : ', with no delay'}.`,
  );

  let delay = req.delay;
  if (inProbation) {
    delay = Math.max(delay, ctx.policy.recipientActivationDelay);
    detail.push(
      `The recipient's activation delay forces a wait of at least ${fmtDuration(ctx.policy.recipientActivationDelay)}.`,
    );
  }
  if (r.tier === Tier.CRITICAL || inProbation || mode !== Mode.NORMAL)
    detail.push('Any guardian can veto it before it executes.');

  if (req.guardians > ctx.guardianCount)
    return {
      verdict: 'impossible',
      detail: [...detail, 'More guardian confirmations are required than there are guardians.'],
    };
  if (compromised < req.approvals) {
    detail.push(
      `The attacker holds ${compromised} approver key${compromised === 1 ? '' : 's'}, fewer than required.`,
    );
    return { verdict: 'blocked', detail };
  }
  if (req.guardians > 0) {
    detail.push('Guardian confirmation is an independent control the attacker does not hold.');
    return { verdict: 'blocked', detail };
  }
  if (delay > 0) return { verdict: 'delayed', detail };
  if (r.tier > Tier.LOW) return { verdict: 'escalated', detail };
  return { verdict: 'allowed', detail };
}

export function runScenarios(ctx: SimContext): ScenarioResult[] {
  const out: ScenarioResult[] = [];
  const pct = (bps: number) => (ctx.balance * BigInt(bps)) / 10_000n;
  const unit = 10n ** BigInt(ctx.decimals);

  {
    const amount = 100_000n * unit;
    const r = single(ctx, amount, Trust.UNKNOWN, true, Mode.NORMAL, 1);
    out.push({
      id: 'single-signer-new-address',
      title: 'One finance signer compromised',
      narrative: `An attacker with a single approver key opens ${fmt(amount, ctx)} to an address the vault has never paid.`,
      ...r,
    });
  }
  {
    const amount = pct(4_000);
    const r = single(ctx, amount, Trust.VERIFIED, false, Mode.NORMAL, 3);
    out.push({
      id: 'three-signers-40pct',
      title: 'Three signers compromised, 40% of the treasury',
      narrative: `An attacker with three approver keys opens ${fmt(amount, ctx)} — 40% of holdings — to a recipient the vault has already verified.`,
      ...r,
    });
  }
  {
    const each = 9_900n * unit;
    const total = each * 20n;
    const caps = effectiveCaps(ctx.limits.perTxMax, ctx.limits.dailyMax, Mode.NORMAL);
    const envelope = ctx.policy.envelopeBps === 0 ? 0n : pct(ctx.policy.envelopeBps);
    const detail: string[] = [];
    let verdict: Verdict = 'allowed';
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
    detail.push(`On its own each payment is ${TIER_LABELS[tierEach.tier]} tier.`);
    if (caps.dailyMax !== 0n && total > caps.dailyMax) {
      const n = Number(caps.dailyMax / each);
      detail.push(
        `The daily cap of ${fmt(caps.dailyMax, ctx)} stops execution after ${n} payment${n === 1 ? '' : 's'}, at ${fmt(each * BigInt(n), ctx)}.`,
      );
      verdict = 'blocked';
    }
    if (envelope !== 0n && total > envelope) {
      const n = Number(envelope / each);
      detail.push(
        `The loss envelope of ${fmt(envelope, ctx)} trips the breaker after ${n} payment${n === 1 ? '' : 's'}, and the vault latches into Lockdown.`,
      );
      verdict = 'blocked';
    }
    if (caps.dailyMax !== 0n && each * 2n > caps.dailyMax / 2n) {
      detail.push("Once half the day's allowance is gone, every further payment is scored high risk.");
      if (verdict === 'allowed') verdict = 'escalated';
    }
    if (verdict === 'allowed')
      detail.push(
        'No cumulative control is configured, so the split drain would succeed. Set a daily cap or a loss envelope.',
      );
    out.push({
      id: 'split-drain',
      title: 'A drain split into twenty payments',
      narrative: `Twenty payments of ${fmt(each, ctx)}, ${fmt(total, ctx)} in total, inside one day.`,
      verdict,
      detail,
    });
  }
  {
    const detail = [
      `Lowering any threshold, delay or cap is a security-reducing change: it waits ${fmtDuration(ctx.policy.policyChangeDelay)} and any guardian can veto it.`,
      `It needs ${ctx.policy.governanceThreshold} owner approval${ctx.policy.governanceThreshold === 1 ? '' : 's'}, and cannot be opened at all while the vault is in Lockdown.`,
      'Until it takes effect, payments already in flight keep the requirements pinned when they were opened.',
    ];
    const verdict: Verdict = ctx.policy.policyChangeDelay > 0 ? 'delayed' : 'allowed';
    if (verdict === 'allowed')
      detail.push(
        'The policy-change delay is zero, so a compromised owner quorum could weaken the vault at once. Set a delay.',
      );
    out.push({
      id: 'policy-weaken',
      title: 'An attacker weakens the policy first',
      narrative: 'A compromised owner quorum lowers approvals and caps before trying to drain the vault.',
      verdict,
      detail,
    });
  }
  {
    out.push({
      id: 'guardian-compromised',
      title: 'A guardian key is compromised',
      narrative: 'An attacker holding a guardian key tries to take funds.',
      verdict: 'impossible',
      detail: [
        'A guardian holds no treasury role: it cannot open, approve or execute a payment, and the contract refuses to give a guardian any treasury role.',
        `The worst it can do is freeze the vault, or open a recovery that waits ${fmtDuration(ctx.policy.recoveryDelay)} and that any owner can cancel.`,
      ],
    });
  }
  {
    const r = single(ctx, ctx.limits.lowMax, Trust.VERIFIED, false, Mode.ELEVATED, 2);
    out.push({
      id: 'elevated-routine',
      title: 'A routine payment during an incident',
      narrative: `The vault is in Elevated mode and a ${fmt(ctx.limits.lowMax, ctx)} routine payment is opened.`,
      ...r,
    });
  }
  {
    const detail = [
      'An agent holds the proposer role only. It can open a payment and nothing else.',
      `Whatever it opens still needs ${ctx.policy.approvalsLow} approval${ctx.policy.approvalsLow === 1 ? '' : 's'} from a human approver for a routine amount, and more above it.`,
      'A compromised agent is a queue full of proposals nobody approves, not a withdrawal.',
    ];
    out.push({
      id: 'agent-compromised',
      title: 'An automated agent is compromised',
      narrative: 'An attacker takes over the key an automation uses to request payments.',
      verdict: 'blocked',
      detail,
    });
  }
  return out;
}
