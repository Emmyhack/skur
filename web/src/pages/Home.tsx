import { useState } from "react";
import { NATIVE_ASSET } from "../config/chain";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtBps, fmtDuration, fmtRelative } from "../lib/format";
import { computeMaxLoss } from "../lib/maxLoss";
import { Mode, Status } from "../lib/types";
import { TxRow } from "../components/TxRow";
import { Address, Button, Card, Empty, KV, TokenIcon } from "../components/ui";
import { IconReceive, IconSend, IconShield } from "../components/icons";
import { Posture, postureItems } from "./Security";
import type { Page } from "../components/Layout";

function splitAmount(s: string): [string, string] {
  const [int, frac] = s.split(".");
  return [int, frac ? `.${frac}` : ""];
}

export function Home({ vault, onChanged, onNavigate, onNewTransaction }: { vault: VaultData; onChanged: () => void; onNavigate: (p: Page) => void; onNewTransaction: () => void }) {
  const [showReceive, setShowReceive] = useState(false);
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING);
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const native = vault.assets.find((a) => a.address === NATIVE_ASSET);
  const loss = stable ? computeMaxLoss(vault.policy, stable.limits, stable.balance, vault.mode) : null;
  const items = postureItems(vault);
  const weakest = items.find((i) => i.ok === "bad") ?? items.find((i) => i.ok === "warn");
  const [intPart, decPart] = stable ? splitAmount(fmtAmount(stable.balance, stable.decimals, undefined, 2)) : ["0", ""];
  const canPropose = vault.mode !== Mode.LOCKDOWN;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Home</h1>
        </div>
      </div>

      <Card>
        <div className="hero-value">
          <div>
            <div className="label">Total asset value</div>
            <div className="amount num">
              {intPart}
              <span className="dec">{decPart} {stable?.symbol}</span>
            </div>
            <div className="sub num">
              {native ? `+ ${fmtAmount(native.balance, native.decimals, native.symbol)}` : ""} · {vault.members.length} members · policy v{vault.policyVersion}
            </div>
          </div>
          <div className="hero-actions">
            <Button onClick={onNewTransaction} disabled={!canPropose} icon={<IconSend width={16} height={16} />}>
              Send
            </Button>
            <Button kind="secondary" onClick={() => setShowReceive((s) => !s)} icon={<IconReceive width={16} height={16} />}>
              Receive
            </Button>
          </div>
        </div>
        {showReceive && (
          <div className="notice notice-info" style={{ marginTop: 16 }}>
            <div>
              Send KASH or an approved token to <Address value={vault.address} full copy />. Deposits are always accepted, even in Lockdown.
            </div>
          </div>
        )}
      </Card>

      {weakest && (
        <div className={`banner ${weakest.ok === "bad" ? "warn" : ""}`}>
          <span className="glyph"><IconShield /></span>
          <div style={{ flex: 1 }}>
            <h4>{weakest.ok === "bad" ? "Strengthen your vault" : "Your vault is well protected"}</h4>
            <div className="muted">{weakest.text}. {weakest.ok === "bad" ? "Fix it under Policies or Members before real funds arrive." : "Review the remaining suggestions under Security."}</div>
          </div>
          <Button kind="secondary" size="sm" onClick={() => onNavigate("security")}>Review</Button>
        </div>
      )}

      <div className="home-grid">
        <div>
          <Card flush title="Assets" actions={<button className="link" onClick={() => onNavigate("assets")}>View all</button>}>
            <ul className="list">
              {vault.assets.map((a) => {
                const v = vault.velocity[a.address.toLowerCase()];
                const pct = v && v.dailyMax ? Number((v.daySpent * 100n) / v.dailyMax) : 0;
                return (
                  <li key={a.address}>
                    <TokenIcon symbol={a.symbol} />
                    <div className="grow">
                      <div className="title">{a.symbol === "KASH" ? "KASH (native)" : a.symbol}</div>
                      <div className="sub">
                        {v && v.dailyMax ? `Today ${fmtAmount(v.daySpent, a.decimals)} of ${fmtAmount(v.dailyMax, a.decimals)} daily cap` : "no daily cap"}
                      </div>
                    </div>
                    <div className="right">
                      <div className="strong num">{fmtAmount(a.balance, a.decimals)}</div>
                      <div className="sub">{a.limits.approved ? "approved" : "not approved"}</div>
                    </div>
                    {v && v.dailyMax > 0n && (
                      <div style={{ width: 80 }}>
                        <div className={`bar ${pct > 80 ? "bad" : pct > 50 ? "warn" : ""}`} style={{ marginTop: 0 }}>
                          <i style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Policy at a glance" subtitle={`Version ${vault.policyVersion} · every control below is enforced by the contract`} actions={<button className="link" onClick={() => onNavigate("policies")}>Edit</button>}>
            <KV
              rows={[
                ["Approvals by tier", `Low ${vault.policy.approvalsLow} · High ${vault.policy.approvalsHigh} · Critical ${vault.policy.approvalsCritical}${vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""}`],
                ["Delays", `High ${fmtDuration(vault.policy.delayHigh)} · Critical ${fmtDuration(vault.policy.delayCritical)} · New recipient ${fmtDuration(vault.policy.recipientActivationDelay)}`],
                ["Exposure escalation", `High ≥ ${fmtBps(vault.policy.highExposureBps)} · Critical ≥ ${fmtBps(vault.policy.criticalExposureBps)}${vault.policy.hardBlockExposureBps ? ` · blocked > ${fmtBps(vault.policy.hardBlockExposureBps)}` : ""}`],
                ["Circuit breaker", vault.policy.envelopeBps ? `${fmtBps(vault.policy.envelopeBps)} of holdings per ${fmtDuration(vault.policy.envelopeWindow)}, then Lockdown` : "off"],
                ...(loss && stable ? [["Max loss with no delay", `${fmtAmount(loss.immediate, stable.decimals, stable.symbol)} (${loss.immediateBinding})`] as [string, string]] : []),
              ]}
            />
          </Card>
        </div>

        <div>
          <Card flush title="Pending transactions" subtitle={pending.length ? `${pending.length} awaiting action` : undefined} actions={<button className="link" onClick={() => onNavigate("transactions")}>View all</button>}>
            {vault.activityLoading ? (
              <Empty>Loading the queue…</Empty>
            ) : pending.length === 0 ? (
              <Empty>Nothing in the queue.</Empty>
            ) : (
              <div>
                {pending.slice(0, 5).map((p) => (
                  <TxRow key={String(p.id)} p={p} vault={vault} onChanged={onChanged} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Security posture" subtitle="Confirmed controls and obvious weaknesses. Not a measure of absolute security." actions={<button className="link" onClick={() => onNavigate("security")}>Details</button>}>
            <Posture vault={vault} compact />
          </Card>

          {vault.assets.some((a) => (vault.velocity[a.address.toLowerCase()]?.envelope ?? 0n) > 0n) && (
            <Card title="Loss envelope" subtitle="Cumulative outflow per window. Exceeding it freezes the vault instead of paying.">
              <KV
                rows={vault.assets.map((a) => {
                  const v = vault.velocity[a.address.toLowerCase()];
                  return [a.symbol, v && v.envelope ? `${fmtAmount(v.envelopeSpent, a.decimals)} of ${fmtAmount(v.envelope, a.decimals)}${v.envelopeResetsAt > 0n ? ` · resets ${fmtRelative(v.envelopeResetsAt)}` : ""}` : "not started"] as [string, string];
                })}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
