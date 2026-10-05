import { DAY, Mode } from '../types.js';
import { effectiveCaps } from './risk.js';
import { fmtDuration } from './format.js';
function min(...xs) {
    return xs.reduce((a, b) => (b < a ? b : a));
}
export function computeMaxLoss(policy, limits, balance, mode) {
    const caps = effectiveCaps(limits.perTxMax, limits.dailyMax, mode);
    const assumptions = [
        'Enough approvers to satisfy each tier are compromised and cooperate.',
        'Executors are compromised or colluding.',
        'No guardian vetoes or freezes the vault during any delay window.',
        'The attacker pays addresses that are already activated, not in probation.',
        'Limits are per asset: each asset has its own caps and its own envelope.',
    ];
    // Immediate: the routine tier needs no delay, so an attacker repeats it until a cumulative
    // control binds. In Elevated there is no undelayed tier at all.
    let immediate = 0n;
    let immediateBinding = 'no undelayed tier';
    if (mode === Mode.NORMAL) {
        const exposureLow = policy.highExposureBps === 0
            ? balance
            : (balance * BigInt(Math.max(policy.highExposureBps - 1, 0))) / 10000n;
        const perTransfer = min(limits.lowMax, caps.perTxMax || limits.lowMax, exposureLow);
        if (perTransfer > 0n) {
            immediate = balance;
            immediateBinding = 'the entire balance (no daily cap and no envelope)';
            const envelope = policy.envelopeBps === 0 ? 0n : (balance * BigInt(policy.envelopeBps)) / 10000n;
            if (caps.dailyMax !== 0n && caps.dailyMax < immediate) {
                immediate = caps.dailyMax;
                immediateBinding = 'the daily cap';
            }
            if (envelope !== 0n && envelope < immediate) {
                immediate = envelope;
                immediateBinding = `the loss envelope per ${fmtDuration(policy.envelopeWindow)}`;
            }
        }
        else {
            immediateBinding = 'the routine tier is disabled by the limits';
        }
    }
    // Within a day: the high tier is also reachable if its delay is under a day. Either way the
    // attacker can straddle a bucket boundary and get two windows' worth.
    const envelope = policy.envelopeBps === 0 ? 0n : (balance * BigInt(policy.envelopeBps)) / 10000n;
    const perTx = caps.perTxMax === 0n ? balance : caps.perTxMax;
    const highCeiling = policy.criticalExposureBps === 0
        ? balance
        : (balance * BigInt(Math.max(policy.criticalExposureBps - 1, 0))) / 10000n;
    const candidates = [[balance, 'the entire balance']];
    if (caps.dailyMax !== 0n)
        candidates.push([caps.dailyMax * 2n, 'two daily buckets across a boundary']);
    if (envelope !== 0n)
        candidates.push([envelope * 2n, 'two envelope windows across a boundary']);
    if (policy.delayHigh >= DAY) {
        candidates.push([immediate * 2n, 'the routine tier only, across two buckets']);
    }
    else {
        candidates.push([
            min(perTx, highCeiling) === 0n ? 0n : balance,
            'the high tier, reachable within a day',
        ]);
    }
    let [day, dayBinding] = candidates.reduce((a, b) => (b[0] < a[0] ? b : a));
    if (mode === Mode.LOCKDOWN) {
        immediate = 0n;
        day = 0n;
        immediateBinding = 'the vault is in Lockdown';
        dayBinding = 'the vault is in Lockdown';
    }
    return {
        immediate,
        day,
        criticalDelay: policy.delayCritical,
        highDelay: policy.delayHigh,
        immediateBinding,
        dayBinding,
        assumptions,
    };
}
//# sourceMappingURL=maxLoss.js.map