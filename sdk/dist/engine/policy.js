import { BPS, HOUR, Trust } from '../types.js';
import { POLICY_ERRORS } from '../errors.js';
/**
 * Mirror of `sui/sources/policy.move`. The codes are the Move abort codes, so a draft validated
 * here fails for the same reason and with the same number as it would on chain.
 */
const MIN_EXECUTION_WINDOW = HOUR;
export const OK = 0;
export function validatePolicyCode(p) {
    if (p.approvalsLow === 0)
        return 1;
    if (p.approvalsHigh < p.approvalsLow)
        return 2;
    if (p.approvalsCritical < p.approvalsHigh)
        return 3;
    if (p.governanceThreshold === 0)
        return 4;
    if (p.guardianRequiredCritical && p.guardianThreshold === 0)
        return 5;
    if (p.delayCritical < p.delayHigh)
        return 6;
    if (p.criticalExposureBps !== 0 && p.highExposureBps > p.criticalExposureBps)
        return 7;
    if (p.criticalExposureBps > Number(BPS) || p.highExposureBps > Number(BPS))
        return 8;
    if (p.hardBlockExposureBps !== 0 && p.hardBlockExposureBps < p.criticalExposureBps)
        return 9;
    if (p.hardBlockExposureBps > Number(BPS))
        return 10;
    if (p.envelopeBps > Number(BPS))
        return 11;
    if (p.envelopeBps !== 0 && p.envelopeWindow < MIN_EXECUTION_WINDOW)
        return 12;
    if (p.proposalTtl < longestDelay(p) + MIN_EXECUTION_WINDOW)
        return 13;
    return OK;
}
export function longestDelay(p) {
    return Math.max(p.delayCritical, p.policyChangeDelay, p.recoveryDelay, p.recipientActivationDelay);
}
/** Every failing rule, not just the first, so an editor can mark all of them at once. */
export function validatePolicy(p) {
    const errs = [];
    const push = (code) => errs.push(POLICY_ERRORS[code]);
    if (p.approvalsLow === 0)
        push(1);
    if (p.approvalsHigh < p.approvalsLow)
        push(2);
    if (p.approvalsCritical < p.approvalsHigh)
        push(3);
    if (p.governanceThreshold === 0)
        push(4);
    if (p.guardianRequiredCritical && p.guardianThreshold === 0)
        push(5);
    if (p.delayCritical < p.delayHigh)
        push(6);
    if (p.criticalExposureBps !== 0 && p.highExposureBps > p.criticalExposureBps)
        push(7);
    if (p.criticalExposureBps > Number(BPS) || p.highExposureBps > Number(BPS))
        push(8);
    if (p.hardBlockExposureBps !== 0 && p.hardBlockExposureBps < p.criticalExposureBps)
        push(9);
    if (p.hardBlockExposureBps > Number(BPS))
        push(10);
    if (p.envelopeBps > Number(BPS))
        push(11);
    if (p.envelopeBps !== 0 && p.envelopeWindow < MIN_EXECUTION_WINDOW)
        push(12);
    if (p.proposalTtl < longestDelay(p) + MIN_EXECUTION_WINDOW)
        push(13);
    return errs;
}
export function validateLimits(l) {
    const errs = [];
    if (l.lowMax > l.highMax)
        errs.push(POLICY_ERRORS[20]);
    if (l.perTxMax !== 0n && l.dailyMax !== 0n && l.perTxMax > l.dailyMax)
        errs.push(POLICY_ERRORS[21]);
    return errs;
}
export function validateCounts(p, owners, approvers, executors, guardians) {
    const errs = [];
    if (owners < 1)
        errs.push(POLICY_ERRORS[30]);
    if (executors < 1)
        errs.push(POLICY_ERRORS[31]);
    if (owners < p.governanceThreshold)
        errs.push(`The governance threshold (${p.governanceThreshold}) exceeds the number of owners (${owners}).`);
    if (approvers < p.approvalsCritical)
        errs.push(`Critical approvals (${p.approvalsCritical}) exceed the number of approvers (${approvers}).`);
    if (guardians < p.guardianThreshold)
        errs.push(`The guardian threshold (${p.guardianThreshold}) exceeds the number of guardians (${guardians}).`);
    return errs;
}
/** Where zero means "disabled", going to zero is the loosest move available. */
function thresholdLoosens(a, b) {
    if (a === 0 || a === 0n)
        return false;
    if (b === 0 || b === 0n)
        return true;
    return b > a;
}
/** The fields `b` gives up relative to `a`. Empty means the change only tightens. */
export function policyReductions(a, b) {
    const out = [];
    if (b.approvalsLow < a.approvalsLow)
        out.push('fewer approvals for routine payments');
    if (b.approvalsHigh < a.approvalsHigh)
        out.push('fewer approvals for high-risk payments');
    if (b.approvalsCritical < a.approvalsCritical)
        out.push('fewer approvals for critical payments');
    if (b.governanceThreshold < a.governanceThreshold)
        out.push('a lower governance threshold');
    if (b.guardianThreshold < a.guardianThreshold)
        out.push('fewer guardian confirmations');
    if (a.guardianRequiredCritical && !b.guardianRequiredCritical)
        out.push('no guardian required for critical payments');
    if (b.delayHigh < a.delayHigh)
        out.push('a shorter high-risk delay');
    if (b.delayCritical < a.delayCritical)
        out.push('a shorter critical delay');
    if (b.recipientActivationDelay < a.recipientActivationDelay)
        out.push('a shorter new-recipient delay');
    if (b.policyChangeDelay < a.policyChangeDelay)
        out.push('a shorter policy-change delay');
    if (b.recoveryDelay < a.recoveryDelay)
        out.push('a shorter recovery delay');
    if (b.proposalTtl > a.proposalTtl)
        out.push('a longer proposal lifetime');
    if (thresholdLoosens(a.highExposureBps, b.highExposureBps))
        out.push('a higher exposure threshold before escalation');
    if (thresholdLoosens(a.criticalExposureBps, b.criticalExposureBps))
        out.push('a higher exposure threshold before critical');
    if (thresholdLoosens(a.hardBlockExposureBps, b.hardBlockExposureBps))
        out.push('a weaker exposure hard block');
    if (thresholdLoosens(a.envelopeBps, b.envelopeBps))
        out.push('a larger loss envelope');
    if (a.envelopeBps !== 0 && b.envelopeWindow < a.envelopeWindow)
        out.push('a shorter envelope window');
    return out;
}
export function limitReductions(a, b) {
    const out = [];
    if (!a.approved && b.approved)
        out.push('approving a new asset');
    if (b.lowMax > a.lowMax)
        out.push('a higher routine maximum');
    if (b.highMax > a.highMax)
        out.push('a higher high-tier maximum');
    if (thresholdLoosens(a.perTxMax, b.perTxMax))
        out.push('a weaker per-transaction cap');
    if (thresholdLoosens(a.dailyMax, b.dailyMax))
        out.push('a weaker daily cap');
    return out;
}
/** Raising trust, or lifting a restriction, is security-reducing; tightening is not. */
export function trustReduces(from, to) {
    const heldBack = from === Trust.RESTRICTED || from === Trust.BLOCKED || from === Trust.UNKNOWN;
    if (heldBack && to !== Trust.RESTRICTED && to !== Trust.BLOCKED)
        return true;
    if (to === Trust.BLOCKED || to === Trust.RESTRICTED)
        return false;
    return to > from;
}
//# sourceMappingURL=policy.js.map