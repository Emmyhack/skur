import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtRelative } from "../lib/format";
import { Mode } from "../lib/types";
import { Address, Button, Card, TokenIcon } from "../components/ui";
import { IconSend } from "../components/icons";
import type { Page } from "../components/Layout";

export function Assets({ vault, onSend, onNavigate }: { vault: VaultData; onSend: (asset: `0x${string}`) => void; onNavigate: (p: Page) => void }) {
  const canSend = vault.mode !== Mode.LOCKDOWN;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assets</h1>
          <p>Every asset the vault can pay out, with the limits that govern it. Approving a new asset is a security-reducing policy change.</p>
        </div>
        <Button kind="secondary" onClick={() => onNavigate("policies")}>Manage limits</Button>
      </div>

      <Card flush>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th className="num">Balance</th>
              <th className="num">Routine up to</th>
              <th className="num">Per transaction</th>
              <th className="num">Today / daily cap</th>
              <th className="num">Loss envelope</th>
              <th />
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
                        <div className="strong">{a.symbol === "KASH" ? "KASH (native)" : a.symbol}</div>
                        <div className="caption">{a.address === "0x0000000000000000000000000000000000000000" ? "native token" : <Address value={a.address} />}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num strong">{fmtAmount(a.balance, a.decimals)}</td>
                  <td className="num">{fmtAmount(a.limits.lowMax, a.decimals)}</td>
                  <td className="num">{a.limits.perTxMax ? fmtAmount(a.limits.perTxMax, a.decimals) : "no cap"}</td>
                  <td className="num">{v && v.dailyMax ? `${fmtAmount(v.daySpent, a.decimals)} / ${fmtAmount(v.dailyMax, a.decimals)}` : "no cap"}</td>
                  <td className="num">{v && v.envelope ? `${fmtAmount(v.envelopeSpent, a.decimals)} / ${fmtAmount(v.envelope, a.decimals)}${v.envelopeResetsAt > 0n ? ` · ${fmtRelative(v.envelopeResetsAt)}` : ""}` : "off"}</td>
                  <td className="num">
                    <Button size="sm" kind="secondary" onClick={() => onSend(a.address)} disabled={!canSend || !a.limits.approved} icon={<IconSend width={14} height={14} />}>
                      Send
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="caption">Balances are read directly from the chain. Exposure percentages are computed per asset against these balances; there is no oracle in V1.</p>
    </>
  );
}
