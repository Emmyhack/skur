import { fmtAmount, fmtBps, fmtDuration, short } from "../lib/format";
import { explainReasons, Tier, TIER_LABEL, Trust, TRUST_LABEL, type AssetMeta } from "../lib/types";
import { TierBadge } from "./ui";

export type ReviewInput = {
  asset: AssetMeta;
  to: `0x${string}`;
  toLabel?: string;
  amount: bigint;
  memo: string;
  tier: Tier;
  reasons: number;
  exposureBps: number;
  requiredApprovals: number;
  requiredGuardians: number;
  delay: number;
  trust: Trust;
  activatesAt?: bigint;
  vetoable: boolean;
};

/** Human-readable intent shown before a wallet signature is requested. */
export function RiskReview({ r }: { r: ReviewInput }) {
  const reasons = explainReasons(r.reasons);
  const nowSec = Math.floor(Date.now() / 1000);
  const probationWait = r.activatesAt && Number(r.activatesAt) > nowSec + r.delay ? Number(r.activatesAt) - nowSec : 0;
  const effectiveDelay = Math.max(r.delay, probationWait);
  const remaining = r.asset.balance - r.amount;
  return (
    <div className="review">
      <div className="review-line">
        <span>Action</span>
        <strong>
          Send {fmtAmount(r.amount, r.asset.decimals, r.asset.symbol)} to {r.toLabel ? `${r.toLabel} (${short(r.to)})` : short(r.to)}
        </strong>
      </div>
      {r.memo && (
        <div className="review-line">
          <span>Purpose</span>
          <span>{r.memo}</span>
        </div>
      )}
      <div className="review-line">
        <span>Treasury impact</span>
        <span>
          {fmtBps(r.exposureBps)} of {r.asset.symbol} holdings · {fmtAmount(remaining < 0n ? 0n : remaining, r.asset.decimals, r.asset.symbol)} remains
        </span>
      </div>
      <div className="review-line">
        <span>Recipient</span>
        <span>{TRUST_LABEL[r.trust]}{r.trust === Trust.UNKNOWN ? " · will be registered as New" : ""}</span>
      </div>
      <div className="review-line">
        <span>Risk tier</span>
        <TierBadge tier={r.tier} />
      </div>
      <div className="review-line">
        <span>Security requirement</span>
        <strong>
          {TIER_LABEL[r.tier]} · {r.requiredApprovals} approval{r.requiredApprovals === 1 ? "" : "s"}
          {r.requiredGuardians ? ` + ${r.requiredGuardians} guardian confirmation${r.requiredGuardians === 1 ? "" : "s"}` : ""}
          {effectiveDelay ? ` · executable after ${fmtDuration(effectiveDelay)}` : " · no delay"}
        </strong>
      </div>
      {r.vetoable && (
        <div className="review-line">
          <span>Guardian veto</span>
          <span>Any guardian can cancel this at any point before it executes.</span>
        </div>
      )}
      {reasons.length > 0 && (
        <div className="review-line" style={{ display: "block" }}>
          <span>Why this tier</span>
          <ul className="reasons">
            {reasons.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
