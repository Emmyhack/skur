import { useState } from "react";
import { Address, Button, Field, Section, Switch } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { ARK_DEVNET_EXPLORER, ARK_DEVNET_FAUCET, ARK_DEVNET_RPC, ARK_DEVNET_WS, DEPLOYMENTS } from "../config/chain";
import type { VaultData } from "../hooks/useVault";
import { useTheme } from "../state/theme";
import { useVaultLabel } from "../state/vaultLabel";

type Tab = "setup" | "appearance" | "environment";

/** app.safe.global/settings: horizontal tabs, then label/content sections. */
export function Settings({ vault, vaultAddress, onSwitchVault }: { vault?: VaultData; vaultAddress: `0x${string}` | null; onSwitchVault: () => void }) {
  const [tab, setTab] = useState<Tab>("setup");
  const { theme, toggle } = useTheme();
  const [label, setLabel] = useVaultLabel(vaultAddress);

  return (
    <>
      <div className="tabs">
        {(["setup", "appearance", "environment"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "setup" && (
        <>
          <Section title="Vault">
            {vaultAddress ? (
              <>
                <div className="inline" style={{ gap: 14, marginBottom: 16 }}>
                  <Identicon address={vaultAddress} size={48} />
                  <div>
                    <div className="strong">{label}</div>
                    <Address value={vaultAddress} full copy prefix="ark" />
                  </div>
                </div>
                <Field label="Name" hint="Stored only in this browser. Other members and the chain never see it.">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
                </Field>
                <dl className="kv">
                  <div><dt>Policy version</dt><dd>v{vault?.policyVersion ?? "—"}</dd></div>
                  <div><dt>Members</dt><dd>{vault ? `${vault.members.length} (${vault.counts.guardians} guardians)` : "—"}</dd></div>
                  <div><dt>Proposals</dt><dd>{vault ? `${vault.proposalCount} total · ${vault.pendingCount} pending · ${vault.executedCount} executed` : "—"}</dd></div>
                  <div><dt>Implementation</dt><dd><Address value={DEPLOYMENTS.vaultImplementation} /></dd></div>
                  <div><dt>Factory</dt><dd><Address value={DEPLOYMENTS.factory} /></dd></div>
                </dl>
                <div style={{ marginTop: 16 }}><Button kind="secondary" onClick={onSwitchVault}>Switch vault</Button></div>
              </>
            ) : (
              <Button onClick={onSwitchVault}>Open a vault</Button>
            )}
          </Section>
          <Section title="Contract version">
            <div className="strong">Skur V1 · immutable</div>
            <p className="desc">Vaults are EIP-1167 clones of a verified implementation with no admin and no upgrade slot. Migrating means creating a new vault and moving funds through this vault's own policy.</p>
            <a className="link accent" href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">View source ↗</a>
          </Section>
        </>
      )}

      {tab === "appearance" && (
        <Section title="Appearance">
          <h4>Theme</h4>
          <p className="desc">Light is the default. The choice is stored in this browser.</p>
          <Switch on={theme === "dark"} onChange={toggle} label={theme === "dark" ? "Dark mode" : "Light mode"} />
        </Section>
      )}

      {tab === "environment" && (
        <Section title="Environment">
          <p className="desc">If this interface disappears, the vault stays reachable through these endpoints and the verified contracts on the explorer.</p>
          <dl className="kv">
            <div><dt>Chain</dt><dd>Ark Constellation devnet · 9000 · KASH</dd></div>
            <div><dt>RPC</dt><dd><code>{ARK_DEVNET_RPC}</code></dd></div>
            <div><dt>WebSocket</dt><dd><code>{ARK_DEVNET_WS}</code></dd></div>
            <div><dt>Explorer</dt><dd><a className="link accent" href={ARK_DEVNET_EXPLORER} target="_blank" rel="noreferrer">Blockscout ↗</a></dd></div>
            <div><dt>Faucet</dt><dd><a className="link accent" href={ARK_DEVNET_FAUCET} target="_blank" rel="noreferrer">Request devnet KASH ↗</a></dd></div>
            <div><dt>Test stablecoin (sUSD)</dt><dd><Address value={DEPLOYMENTS.testUsd} /></dd></div>
          </dl>
        </Section>
      )}
    </>
  );
}
