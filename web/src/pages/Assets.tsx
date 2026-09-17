import { useState } from "react";
import { tokenMark } from "../lib/tokens";
import { NATIVE_ASSET } from "../config/chain";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtRelative } from "../lib/format";
import { Mode } from "../lib/types";
import { Address, Button, TokenIcon } from "../components/ui";
import { IconSend } from "../components/icons";
import type { AppPage } from "../components/AppShell";

/** app.safe.global/balances: Tokens tab, total assets value, table with per-row actions. */
export function Assets({ vault, onSend, onNavigate }: { vault: VaultData; onSend: (asset: `0x${string}`) => void; onNavigate: (p: AppPage) => void }) {
  const [tab, setTab] = useState<"tokens" | "limits">("tokens");
  const canSend = vault.mode !== Mode.LOCKDOWN;
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];

  return (
    <>
      <div className="tabs">
        <button className={tab === "tokens" ? "active" : ""} onClick={() => setTab("tokens")}>Tokens</button>
        <button className={tab === "limits" ? "active" : ""} onClick={() => setTab("limits")}>Limits</button>
      </div>

      <div className="balance-row" style={{ marginBottom: 16 }}>
        <div>
          <div className="strong" style={{ fontSize: 16 }}>Total assets value</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{stable ? fmtAmount(stable.balance, stable.decimals, stable.symbol) : "—"}</div>
        </div>
        <div className="inline">
          <span className="caption">Read from the chain {fmtRelative(Math.floor(vault.fetchedAt / 1000))}</span>
          <Button kind="secondary" size="sm" onClick={() => onNavigate("policies")}>Manage assets</Button>
        </div>
      </div>

      <div className="card flush">
        {tab === "tokens" ? (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th className="num">Balance</th>
                <th className="num">Share of holdings</th>
                <th className="num">Today's outflow</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vault.assets.map((a) => {
                const v = vault.velocity[a.address.toLowerCase()];
                return (
                  <tr key={a.address}>
                    <td>
                      <div className="inline" style={{ gap: 12 }}>
                        <TokenIcon symbol={a.symbol} />
                        <div>
                          <div className="strong">{tokenMark(a.symbol).name}</div>
                          <div className="caption">{a.address === NATIVE_ASSET ? "native token" : <Address value={a.address} />}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num strong">{fmtAmount(a.balance, a.decimals)} {a.symbol}</td>
                    <td className="num">{a.limits.approved ? "approved" : "not approved"}</td>
                    <td className="num">{v && v.dailyMax ? `${fmtAmount(v.daySpent, a.decimals)} / ${fmtAmount(v.dailyMax, a.decimals)}` : v ? fmtAmount(v.daySpent, a.decimals) : "—"}</td>
                    <td className="num">
                      <Button size="sm" kind="dark" onClick={() => onSend(a.address)} disabled={!canSend || !a.limits.approved} icon={<IconSend width={14} height={14} />}>Send</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th className="num">Routine up to</th>
                <th className="num">High up to</th>
                <th className="num">Per transaction</th>
                <th className="num">Daily cap</th>
                <th className="num">Loss envelope</th>
              </tr>
            </thead>
            <tbody>
              {vault.assets.map((a) => {
                const v = vault.velocity[a.address.toLowerCase()];
                return (
                  <tr key={a.address}>
                    <td><div className="inline" style={{ gap: 12 }}><TokenIcon symbol={a.symbol} /><span className="strong">{a.symbol}</span></div></td>
                    <td className="num">{fmtAmount(a.limits.lowMax, a.decimals)}</td>
                    <td className="num">{fmtAmount(a.limits.highMax, a.decimals)}</td>
                    <td className="num">{a.limits.perTxMax ? fmtAmount(a.limits.perTxMax, a.decimals) : "no cap"}</td>
                    <td className="num">{a.limits.dailyMax ? fmtAmount(a.limits.dailyMax, a.decimals) : "no cap"}</td>
                    <td className="num">{v && v.envelope ? `${fmtAmount(v.envelopeSpent, a.decimals)} / ${fmtAmount(v.envelope, a.decimals)}${v.envelopeResetsAt > 0n ? ` · resets ${fmtRelative(v.envelopeResetsAt)}` : ""}` : "off"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="caption" style={{ padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
          Payments above the routine threshold need more approvals. Above the high threshold they also need a guardian and a delay. Exposure is measured per asset; V1 has no price oracle.
        </div>
      </div>
    </>
  );
}
