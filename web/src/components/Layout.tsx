import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arkDevnet } from "../config/chain";
import { short } from "../lib/format";
import { Mode, roleNames } from "../lib/types";
import { Button, ModeBadge } from "./ui";
import type { VaultData } from "../hooks/useVault";

export type Page = "overview" | "transactions" | "recipients" | "members" | "policies" | "security" | "simulator" | "settings";

const NAV: Array<[Page, string]> = [
  ["overview", "Overview"],
  ["transactions", "Transactions"],
  ["recipients", "Recipients"],
  ["members", "Members"],
  ["policies", "Policies"],
  ["security", "Security"],
  ["simulator", "Simulator"],
  ["settings", "Settings"],
];

export function Layout({ page, onNavigate, vault, vaultAddress, children }: { page: Page; onNavigate: (p: Page) => void; vault?: VaultData; vaultAddress: `0x${string}` | null; children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const me = vault?.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const wrongChain = isConnected && chainId !== arkDevnet.id;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => onNavigate("overview")}>
          <span className="brand-mark">S</span>
          <span>
            <strong>Skur</strong>
            <small>Treasury security</small>
          </span>
        </div>
        <nav>
          {NAV.map(([id, label]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot muted">
          <div>Ark Constellation devnet</div>
          <div>Chain 9000 · KASH</div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            {vaultAddress ? (
              <>
                <span className="muted">Vault</span> <code title={vaultAddress}>{short(vaultAddress, 6)}</code>
                {vault && <ModeBadge mode={vault.mode} />}
                {vault && vault.mode === Mode.LOCKDOWN && <span className="muted">outgoing execution frozen</span>}
              </>
            ) : (
              <span className="muted">No vault selected</span>
            )}
          </div>
          <div className="topbar-right">
            {me && <span className="muted">{roleNames(me.roles).join(" · ")}</span>}
            {wrongChain && (
              <Button kind="danger" onClick={() => switchChain({ chainId: arkDevnet.id })}>
                Switch to Ark devnet
              </Button>
            )}
            {isConnected ? (
              <Button kind="secondary" onClick={() => disconnect()} title={address}>
                {short(address ?? "", 4)} · Disconnect
              </Button>
            ) : (
              connectors.slice(0, 1).map((c) => (
                <Button key={c.uid} onClick={() => connect({ connector: c })} disabled={isPending}>
                  Connect wallet
                </Button>
              ))
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
