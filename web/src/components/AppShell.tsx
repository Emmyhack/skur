import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arkDevnet, explorerAddress, NATIVE_ASSET } from "../config/chain";
import { fmtAmount } from "../lib/format";
import { Mode, roleNames, Status } from "../lib/types";
import { useTheme } from "../state/theme";
import { useVaultLabel } from "../state/vaultLabel";
import { Button, ModeBadge } from "./ui";
import { Identicon } from "./Identicon";
import { IconApps, IconAssets, IconBook, IconChevron, IconCollapse, IconDocs, IconExternal, IconHelp, IconLab, IconMoon, IconOverview, IconPlus, IconPolicy, IconSettings, IconShield, IconSun, IconTx, IconUsers, IconWallet } from "./icons";
import type { VaultData } from "../hooks/useVault";

export type AppPage = "overview" | "assets" | "transactions" | "addressbook" | "members" | "settings" | "policies" | "security" | "simulator";

const MAIN_NAV: Array<[AppPage, string, ReactNode]> = [
  ["overview", "Overview", <IconOverview key="o" />],
  ["assets", "Assets", <IconAssets key="a" />],
  ["transactions", "Transactions", <IconTx key="t" />],
  ["addressbook", "Address book", <IconBook key="b" />],
  ["members", "Members", <IconUsers key="u" />],
  ["settings", "Settings", <IconSettings key="s" />],
];
const SECURITY_NAV: Array<[AppPage, string, ReactNode]> = [
  ["policies", "Policies", <IconPolicy key="p" />],
  ["security", "Security", <IconShield key="sh" />],
  ["simulator", "Simulator", <IconLab key="l" />],
];

/** Safe{Wallet} application layout: full-height sidebar with the Home pill, content column with the account pill row. */
export function AppShell({ page, onNavigate, onHome, vault, vaultAddress, onNewTransaction, onSwitchVault, children }: { page: AppPage; onNavigate: (p: AppPage) => void; onHome: () => void; vault?: VaultData; vaultAddress: `0x${string}` | null; onNewTransaction: () => void; onSwitchVault: () => void; children: ReactNode }) {
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
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="home-pill" onClick={onHome}>
            <span className="mark">S</span> Home
          </button>
          <button className="icon-btn small" title="Collapse"><IconCollapse width={16} height={16} /></button>
        </div>
        <div className="newtx">
          <Button kind="secondary" onClick={onNewTransaction} disabled={!canPropose} icon={<IconPlus width={16} height={16} />} title={!canPropose ? (vault?.mode === Mode.LOCKDOWN ? "Vault is in Lockdown" : "Connect an owner or approver wallet") : undefined}>
            New transaction
          </Button>
        </div>
        <nav className="nav">
          {MAIN_NAV.map(([id, text, ico]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
              <span className="ico">{ico}</span>
              {text}
              {id === "transactions" && pending > 0 && <span className="count">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-group">Security</div>
        <nav className="nav">
          {SECURITY_NAV.map(([id, text, ico]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
              <span className="ico">{ico}</span>
              {text}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {vault && vault.mode !== Mode.NORMAL && (
            <div className="promo">
              <span className="tag">{vault.mode === Mode.LOCKDOWN ? "LOCKDOWN" : "ELEVATED"}</span>
              <h4>{vault.mode === Mode.LOCKDOWN ? "Outgoing execution is frozen" : "Every transfer is one tier higher"}</h4>
              <p>{vault.mode === Mode.LOCKDOWN ? "Deposits, tightening changes, recovery and guardians keep working." : "Per-transaction and daily caps are halved until owners and guardians lower the mode."}</p>
              <Button size="sm" onClick={() => onNavigate("security")}>Review</Button>
            </div>
          )}
          <nav className="nav">
            <a className="nav-link" href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer" style={{ display: "contents" }}>
              <button><span className="ico"><IconDocs /></span>Docs<span className="tag-new" style={{ marginLeft: "auto" }}>V1</span></button>
            </a>
            <button onClick={() => onNavigate("simulator")}><span className="ico"><IconHelp /></span>Help</button>
          </nav>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <div className="header-row">
            {vaultAddress ? (
              <button className="acct-pill" onClick={onSwitchVault} title="Switch vault">
                <Identicon address={vaultAddress} size={36} />
                <span>
                  <span className="name">{label}</span>
                  <br />
                  <span className="addr">
                    <b>ark:</b>
                    <b>{vaultAddress.slice(0, 6)}</b>
                    {vaultAddress.slice(6, -5)}
                    <b>{vaultAddress.slice(-5)}</b>
                  </span>
                </span>
                {vault && (
                  <span className="meta">
                    <span className="chip-s" title={`${vault.policy.approvalsLow} of ${vault.counts.approvers} approvers confirm a routine transfer`}><IconUsers width={12} height={12} /> {vault.policy.approvalsLow}/{vault.counts.approvers}</span>
                    <span className="num strong">{stable ? fmtAmount(stable.balance, stable.decimals, stable.symbol) : native ? fmtAmount(native.balance, native.decimals, native.symbol) : "—"}</span>
                    <ModeBadge mode={vault.mode} />
                  </span>
                )}
                <IconChevron width={16} height={16} style={{ color: "var(--text-2)" }} />
              </button>
            ) : (
              <button className="acct-pill" onClick={onSwitchVault}>
                <span className="name">No vault selected</span>
                <IconChevron width={16} height={16} />
              </button>
            )}
            <div className="tools-pill">
              <button className="icon-btn" onClick={toggle} title={theme === "light" ? "Dark mode" : "Light mode"}>{theme === "light" ? <IconMoon /> : <IconSun />}</button>
              {vaultAddress && (
                <a className="icon-btn" href={explorerAddress(vaultAddress)} target="_blank" rel="noreferrer" title="View on Blockscout"><IconExternal /></a>
              )}
              {wrongChain ? (
                <Button size="sm" kind="danger" onClick={() => switchChain({ chainId: arkDevnet.id })}>Switch to Ark devnet</Button>
              ) : isConnected && address ? (
                <Button kind="secondary" className="on" onClick={() => disconnect()} title={`${address} · click to disconnect`} icon={<Identicon address={address} size={18} />}>
                  {address.slice(0, 6)}…{address.slice(-4)}{me ? ` · ${roleNames(me.roles).join(", ")}` : ""}
                </Button>
              ) : (
                connectors.slice(0, 1).map((c) => (
                  <Button key={c.uid} kind="secondary" onClick={() => connect({ connector: c })} disabled={isPending} icon={<IconWallet width={16} height={16} />}>
                    Connect Wallet
                  </Button>
                ))
              )}
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export const AppsIcon = IconApps;
