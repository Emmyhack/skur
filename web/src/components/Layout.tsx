import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arkDevnet, explorerAddress, NATIVE_ASSET } from "../config/chain";
import { fmtAmount, short } from "../lib/format";
import { Mode, roleNames, Status } from "../lib/types";
import { useTheme } from "../state/theme";
import { useVaultLabel } from "../state/vaultLabel";
import { Button, CopyButton, ModeBadge } from "./ui";
import { Identicon } from "./Identicon";
import { IconAssets, IconBook, IconExternal, IconHome, IconLab, IconMoon, IconPolicy, IconSettings, IconShield, IconSun, IconTx, IconUsers } from "./icons";
import type { VaultData } from "../hooks/useVault";

export type Page = "home" | "assets" | "transactions" | "recipients" | "members" | "policies" | "security" | "simulator" | "settings";

const MAIN_NAV: Array<[Page, string, ReactNode]> = [
  ["home", "Home", <IconHome key="h" />],
  ["assets", "Assets", <IconAssets key="a" />],
  ["transactions", "Transactions", <IconTx key="t" />],
  ["recipients", "Address book", <IconBook key="b" />],
  ["members", "Members", <IconUsers key="u" />],
  ["settings", "Settings", <IconSettings key="s" />],
];
const SECURITY_NAV: Array<[Page, string, ReactNode]> = [
  ["policies", "Policies", <IconPolicy key="p" />],
  ["security", "Security", <IconShield key="sh" />],
  ["simulator", "Simulator", <IconLab key="l" />],
];

export function Layout({ page, onNavigate, vault, vaultAddress, onNewTransaction, children }: { page: Page; onNavigate: (p: Page) => void; vault?: VaultData; vaultAddress: `0x${string}` | null; onNewTransaction: () => void; children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { theme, toggle } = useTheme();
  const [label] = useVaultLabel(vaultAddress);
  const me = vault?.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const wrongChain = isConnected && chainId !== arkDevnet.id;
  const pending = vault?.proposals.filter((p) => p.status === Status.PENDING).length ?? 0;
  const stable = vault?.assets.find((a) => a.address !== NATIVE_ASSET);
  const native = vault?.assets.find((a) => a.address === NATIVE_ASSET);
  const canPropose = Boolean((me?.roles ?? 0) & 3) && vault?.mode !== Mode.LOCKDOWN;

  return (
    <div className="app">
      <header className="topbar">
        <a className="wordmark" href="#home" onClick={(e) => { e.preventDefault(); onNavigate("home"); }}>
          <span className="mark">S</span>
          <span>
            Skur<span className="brace">{"{"}</span>Vault<span className="brace">{"}"}</span>
          </span>
        </a>
        <div className="topbar-right">
          <button className="icon-btn" onClick={toggle} title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            {theme === "light" ? <IconMoon /> : <IconSun />}
          </button>
          <span className={`chip ${wrongChain ? "warn" : ""}`} title="Ark Constellation devnet · chain 9000" onClick={() => wrongChain && switchChain({ chainId: arkDevnet.id })}>
            <span className="dot" /> {wrongChain ? "Switch to Ark devnet" : "Ark devnet"}
          </span>
          {isConnected && address ? (
            <button className="chip" onClick={() => disconnect()} title={`${address} · click to disconnect`}>
              <Identicon address={address} size={20} />
              <span>
                <span className="strong">{short(address, 4)}</span>
                {me && <span className="muted"> · {roleNames(me.roles).join(", ")}</span>}
              </span>
            </button>
          ) : (
            connectors.slice(0, 1).map((c) => (
              <Button key={c.uid} onClick={() => connect({ connector: c })} disabled={isPending}>
                Connect wallet
              </Button>
            ))
          )}
        </div>
      </header>

      <div className="frame">
        <aside className="sidebar">
          {vaultAddress ? (
            <>
              <div className="account">
                <Identicon address={vaultAddress} size={40} />
                <div className="meta">
                  <div className="name truncate">{label}</div>
                  <div className="addr">ark:{short(vaultAddress, 4)}</div>
                  {vault && (
                    <div className="value num">
                      {stable ? fmtAmount(stable.balance, stable.decimals, stable.symbol) : native ? fmtAmount(native.balance, native.decimals, native.symbol) : "—"}
                    </div>
                  )}
                </div>
              </div>
              <div className="account-tools">
                <CopyButton value={vaultAddress} />
                <a className="icon-btn small" href={explorerAddress(vaultAddress)} target="_blank" rel="noreferrer" title="View on explorer">
                  <IconExternal width={14} height={14} />
                </a>
                {vault && <span style={{ marginLeft: "auto", alignSelf: "center" }}><ModeBadge mode={vault.mode} /></span>}
              </div>
              <div className="new-tx">
                <Button block onClick={onNewTransaction} disabled={!canPropose} title={!canPropose ? (vault?.mode === Mode.LOCKDOWN ? "Vault is in Lockdown" : "Connect an owner or approver") : undefined}>
                  New transaction
                </Button>
              </div>
            </>
          ) : (
            <div className="account">
              <div className="meta">
                <div className="name">No vault selected</div>
                <div className="addr">Open one under Settings</div>
              </div>
            </div>
          )}
          <nav className="nav">
            {MAIN_NAV.map(([id, text, ico]) => (
              <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
                <span className="ico">{ico}</span>
                {text}
                {id === "transactions" && pending > 0 && <span className="count">{pending}</span>}
              </button>
            ))}
          </nav>
          <div className="nav-group overline">Security</div>
          <nav className="nav">
            {SECURITY_NAV.map(([id, text, ico]) => (
              <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
                <span className="ico">{ico}</span>
                {text}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            Ark Constellation devnet · chain 9000
            <br />
            Every control is enforced by the vault contract.
          </div>
        </aside>
        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
