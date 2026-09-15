import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDuration, fmtRelative } from "../lib/format";
import { computeMaxLoss } from "../lib/maxLoss";
import { Kind, Mode, Status } from "../lib/types";
import { ProposalCard } from "../components/ProposalCard";
import { Card, Empty, ModeBadge, Stat } from "../components/ui";
import { Posture } from "./Security";

export function Overview({ vault, onChanged, onNavigate }: { vault: VaultData; onChanged: () => void; onNavigate: (p: "transactions" | "security") => void }) {
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING);
  const needsMe = pending.length;
  const stable = vault.assets.find((a) => a.address !== "0x0000000000000000000000000000000000000000") ?? vault.assets[0];
  const loss = stable ? computeMaxLoss(vault.policy, stable.limits, stable.balance, vault.mode) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Treasury position, pending approvals and security posture.</p>
        </div>
        <ModeBadge mode={vault.mode} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        {vault.assets.map((a) => (
          <Stat key={a.address} label={`${a.symbol} balance`} value={fmtAmount(a.balance, a.decimals)} hint={a.limits.approved ? "approved asset" : "not approved"} />
        ))}
        <Stat label="Pending proposals" value={needsMe} hint={`${vault.executedCount} executed`} tone={needsMe ? "warn" : undefined} />
        <Stat label="Members" value={vault.members.length} hint={`${vault.counts.guardians} guardian${vault.counts.guardians === 1 ? "" : "s"}`} tone={vault.counts.guardians ? "ok" : "bad"} />
        {loss && stable && (
          <Stat
            label="Max loss without delay"
            value={fmtAmount(loss.immediate, stable.decimals, stable.symbol)}
            hint={`bounded by ${loss.immediateBinding}`}
            tone={vault.mode === Mode.LOCKDOWN ? "ok" : loss.immediate * 5n > stable.balance ? "bad" : "ok"}
          />
        )}
      </div>

      <div className="grid grid-2">
        <Card title="Outflow today" subtitle="Cumulative accounting per asset. Splitting a payment does not help.">
          {vault.assets.map((a) => {
            const v = vault.velocity[a.address.toLowerCase()];
            if (!v) return null;
            const pct = v.dailyMax ? Number((v.daySpent * 100n) / v.dailyMax) : 0;
            const epct = v.envelope ? Number((v.envelopeSpent * 100n) / v.envelope) : 0;
            return (
              <div key={a.address} style={{ marginBottom: 12 }}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <strong>{a.symbol}</strong>
                  <span className="small muted">
                    {fmtAmount(v.daySpent, a.decimals)} / {v.dailyMax ? fmtAmount(v.dailyMax, a.decimals) : "no daily cap"}
                  </span>
                </div>
                {v.dailyMax > 0n && (
                  <div className={`bar ${pct > 80 ? "bad" : pct > 50 ? "warn" : ""}`}>
                    <i style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                )}
                {v.envelope > 0n && (
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Loss envelope: {fmtAmount(v.envelopeSpent, a.decimals)} of {fmtAmount(v.envelope, a.decimals)} ({epct}%)
                    {v.envelopeResetsAt > 0n ? ` · resets ${fmtRelative(v.envelopeResetsAt)}` : " · window not started"}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
        <Card title="Security posture" subtitle="Confirmed controls and obvious weaknesses. Not a measure of absolute security." actions={<a href="#security" onClick={(e) => { e.preventDefault(); onNavigate("security"); }}>Details</a>}>
          <Posture vault={vault} compact />
        </Card>
      </div>

      <Card title="Policy at a glance" subtitle={`Version ${vault.policyVersion}`}>
        <div className="grid grid-3">
          <div>
            <div className="muted small">Approvals by tier</div>
            <div>Low {vault.policy.approvalsLow} · High {vault.policy.approvalsHigh} · Critical {vault.policy.approvalsCritical}{vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""}</div>
          </div>
          <div>
            <div className="muted small">Delays</div>
            <div>High {fmtDuration(vault.policy.delayHigh)} · Critical {fmtDuration(vault.policy.delayCritical)} · New recipient {fmtDuration(vault.policy.recipientActivationDelay)}</div>
          </div>
          <div>
            <div className="muted small">Exposure escalation</div>
            <div>High ≥ {fmtBps(vault.policy.highExposureBps)} · Critical ≥ {fmtBps(vault.policy.criticalExposureBps)}{vault.policy.hardBlockExposureBps ? ` · blocked > ${fmtBps(vault.policy.hardBlockExposureBps)}` : ""}</div>
          </div>
        </div>
      </Card>

      <Card title="Needs attention" subtitle="Pending proposals, newest first." actions={<a href="#transactions" onClick={(e) => { e.preventDefault(); onNavigate("transactions"); }}>All transactions</a>}>
        {pending.length === 0 ? <Empty>Nothing pending.</Empty> : pending.slice(0, 5).map((p) => <ProposalCard key={String(p.id)} p={p} vault={vault} onChanged={onChanged} />)}
        {pending.some((p) => p.kind !== Kind.TRANSFER) && <p className="small muted">Governance proposals need owner approvals; security-reducing ones wait for their timelock.</p>}
      </Card>
    </>
  );
}
