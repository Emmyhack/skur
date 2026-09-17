import { useState } from "react";
import { tokenMark } from "../lib/tokens";
import { NATIVE_ASSET } from "../config/chain";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtDuration } from "../lib/format";
import { Mode, Status } from "../lib/types";
import { TxRow } from "../components/TxRow";
import { Skeleton } from "../components/Reveal";
import { Address, Button, Card, Empty, TokenIcon } from "../components/ui";
import { IconArrowRight, IconBank, IconClock, IconGuard, IconLab, IconReceive, IconSend, IconShield } from "../components/icons";
import { postureItems } from "./Security";
import type { AppPage } from "../components/AppShell";

function splitAmount(s: string): [string, string] {
  const [int, frac] = s.split(".");
  return [int, frac ? `.${frac}` : ".00"];
}

/** app.safe.global/home: Total balance card, promo banner, Top assets, "Explore what's possible", Pending transactions. */
export function Overview({ vault, onChanged, onNavigate, onNewTransaction }: { vault: VaultData; onChanged: () => void; onNavigate: (p: AppPage) => void; onNewTransaction: () => void }) {
  const [showReceive, setShowReceive] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const pending = vault.proposals.filter((p) => p.status === Status.PENDING);
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const native = vault.assets.find((a) => a.address === NATIVE_ASSET);
  const items = postureItems(vault);
  const weakest = items.find((i) => i.ok === "bad") ?? items.find((i) => i.ok === "warn");
  const [intPart, decPart] = stable ? splitAmount(fmtAmount(stable.balance, stable.decimals, undefined, 2)) : ["0", ".00"];
  const canPropose = vault.mode !== Mode.LOCKDOWN;

  return (
    <div className="overview-grid">
      <div>
        <Card className="balance-card">
          <div className="balance-row">
            <div>
              <div className="label">Total balance</div>
              <div className="amount num">
                {intPart}
                <span className="dec">{decPart}</span> <span className="dec" style={{ fontSize: 24 }}>{stable?.symbol}</span>
              </div>
              <div className="caption" style={{ marginTop: 6 }}>{native ? `+ ${fmtAmount(native.balance, native.decimals, native.symbol)}` : ""} · policy v{vault.policyVersion} · {vault.members.length} members</div>
            </div>
            <div className="actions">
              <Button onClick={onNewTransaction} disabled={!canPropose} icon={<IconSend width={16} height={16} />}>Send</Button>
              <Button className="hi" onClick={() => setShowReceive((s) => !s)} icon={<IconReceive width={16} height={16} />}>Receive</Button>
              <Button onClick={() => onNavigate("simulator")} icon={<IconLab width={16} height={16} />}>Simulate</Button>
            </div>
          </div>
          {showReceive && (
            <div className="notice notice-info" style={{ marginTop: 16, marginBottom: 0 }}>
              <div>Send KASH or any approved token to <Address value={vault.address} full copy />. Deposits are accepted in every mode, including Lockdown.</div>
            </div>
          )}
        </Card>

        {weakest && !bannerClosed && (
          <div className={`banner ${weakest.ok === "bad" ? "warn" : ""}`}>
            <span className="glyph"><IconShield width={26} height={26} /></span>
            <div>
              <h4>{weakest.ok === "bad" ? "Strengthen your vault before funds arrive" : "Your vault is in good shape"}</h4>
              <p>{weakest.text}. {weakest.ok === "bad" ? "Fix it under Policies or Members." : "Everything else is confirmed; the details are under Security."}</p>
              <button className="cta" onClick={() => onNavigate("security")}>Open Security <IconArrowRight width={16} height={16} /></button>
            </div>
            <button className="close" onClick={() => setBannerClosed(true)} title="Dismiss">✕</button>
          </div>
        )}

        <Card flush title="Top assets" actions={<button className="link" onClick={() => onNavigate("assets")}>View all ›</button>}>
          <ul className="list">
            {vault.assets.map((a) => {
              const v = vault.velocity[a.address.toLowerCase()];
              return (
                <li key={a.address}>
                  <TokenIcon symbol={a.symbol} />
                  <div className="grow">
                    <div className="title">{tokenMark(a.symbol).name}</div>
                    <div className="sub">{fmtAmount(a.balance, a.decimals)} {a.symbol}</div>
                  </div>
                  <div className="right">
                    <div className="strong num">{fmtAmount(a.balance, a.decimals)}</div>
                    <div className="sub">{v && v.dailyMax ? `${fmtAmount(v.daySpent, a.decimals)} of ${fmtAmount(v.dailyMax, a.decimals)} today` : "no daily cap"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Explore what's possible">
          <div className="explore">
            <button onClick={() => onNavigate("simulator")}><IconLab className="ico" width={56} height={56} />Simulate attacks on your policy</button>
            <button onClick={() => onNavigate("addressbook")}><IconBank className="ico" width={56} height={56} />Register suppliers early so payments clear on time</button>
            <button onClick={() => onNavigate("security")}><IconGuard className="ico" width={56} height={56} />See the most you could lose</button>
            <button onClick={() => onNavigate("policies")}><IconClock className="ico" width={56} height={56} />Tune tiers, delays and caps</button>
          </div>
        </Card>
      </div>

      <div>
        <Card flush title="Pending transactions" actions={pending.length > 0 ? <button className="link" onClick={() => onNavigate("transactions")}>View all ›</button> : undefined}>
          {vault.activityLoading ? (
            <div style={{ padding: "12px 24px 20px" }}>
              <Skeleton h={44} style={{ marginBottom: 8 }} />
              <Skeleton h={44} style={{ marginBottom: 8 }} />
              <Skeleton h={44} />
            </div>
          ) : pending.length === 0 ? (
            <Empty>Nothing waiting for a signature</Empty>
          ) : (
            <div style={{ padding: "0 12px 12px" }}>
              {pending.slice(0, 5).map((p) => <TxRow key={String(p.id)} p={p} vault={vault} onChanged={onChanged} compact />)}
            </div>
          )}
        </Card>
        <Card title="Policy at a glance" actions={<button className="link" onClick={() => onNavigate("policies")}>Edit ›</button>}>
          <dl className="kv">
            <div><dt>Approvals</dt><dd>Low {vault.policy.approvalsLow} · High {vault.policy.approvalsHigh} · Critical {vault.policy.approvalsCritical}{vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""}</dd></div>
            <div><dt>Delays</dt><dd>High {fmtDuration(vault.policy.delayHigh)} · Critical {fmtDuration(vault.policy.delayCritical)}</dd></div>
            <div><dt>New recipients wait</dt><dd>{fmtDuration(vault.policy.recipientActivationDelay)}</dd></div>
            <div><dt>Circuit breaker</dt><dd>{vault.policy.envelopeBps ? `${vault.policy.envelopeBps / 100}% per ${fmtDuration(vault.policy.envelopeWindow)}` : "off"}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
