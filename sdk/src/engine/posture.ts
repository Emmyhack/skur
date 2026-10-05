import { DAY, type AssetLimits, type Policy } from '../types.js';
import { fmtDuration } from './format.js';

/**
 * Plain-language posture checks. This reports confirmed controls and obvious weaknesses; it does
 * not claim to measure absolute security, and it deliberately produces no score.
 */
export type PostureItem = { ok: 'ok' | 'warn' | 'bad'; text: string };

export type PostureInput = {
  policy: Policy;
  guardians: number;
  assets: { symbol: string; limits: AssetLimits }[];
};

export function postureItems({ policy: p, guardians: g, assets }: PostureInput): PostureItem[] {
  const everyAssetCapped = assets.length > 0 && assets.every((a) => a.limits.dailyMax > 0n);
  return [
    {
      ok: g > 0 ? 'ok' : 'bad',
      text: g > 0
        ? `${g} independent guardian${g === 1 ? '' : 's'} configured`
        : 'No guardian: nobody independent can veto or freeze the vault',
    },
    {
      ok: p.guardianRequiredCritical ? 'ok' : 'warn',
      text: p.guardianRequiredCritical
        ? 'Critical payments need guardian confirmation'
        : 'Critical payments do not need a guardian',
    },
    {
      ok: p.delayCritical >= DAY ? 'ok' : 'warn',
      text: `Critical payments wait ${fmtDuration(p.delayCritical)}`,
    },
    {
      ok: p.recipientActivationDelay > 0 ? 'ok' : 'bad',
      text: p.recipientActivationDelay > 0
        ? `New recipients wait ${fmtDuration(p.recipientActivationDelay)}`
        : 'New recipients can be paid immediately',
    },
    {
      ok: everyAssetCapped ? 'ok' : 'warn',
      text: everyAssetCapped
        ? 'A 24-hour outflow cap on every approved asset'
        : 'Some approved assets have no 24-hour cap',
    },
    {
      ok: p.envelopeBps > 0 ? 'ok' : 'warn',
      text: p.envelopeBps > 0
        ? `Circuit breaker at ${p.envelopeBps / 100}% per ${fmtDuration(p.envelopeWindow)}`
        : 'No loss envelope configured',
    },
    {
      ok: p.policyChangeDelay > 0 ? 'ok' : 'bad',
      text: p.policyChangeDelay > 0
        ? `Weakening the policy waits ${fmtDuration(p.policyChangeDelay)} and can be vetoed`
        : 'The policy can be weakened immediately',
    },
    {
      ok: p.recoveryDelay > 0 && g > 0 ? 'ok' : 'warn',
      text: p.recoveryDelay > 0 && g > 0
        ? `Signer recovery available after ${fmtDuration(p.recoveryDelay)}`
        : 'No usable recovery path',
    },
    {
      ok: p.approvalsLow >= 2 ? 'ok' : 'warn',
      text: p.approvalsLow >= 2
        ? 'Routine payments need two approvals'
        : 'Routine payments need a single approval',
    },
    {
      ok: p.hardBlockExposureBps > 0 ? 'ok' : 'warn',
      text: p.hardBlockExposureBps > 0
        ? `No single payment may exceed ${p.hardBlockExposureBps / 100}% of an asset`
        : 'No hard block: a single payment could take the whole balance if approved',
    },
  ];
}
