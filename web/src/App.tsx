import { useEffect, useState } from "react";
import { AppShell, type AppPage } from "./components/AppShell";
import { TxFlow } from "./components/TxFlow";
import { Empty } from "./components/ui";
import { useInvalidateVault, useVault } from "./hooks/useVault";
import { AddressBook } from "./pages/AddressBook";
import { Assets } from "./pages/Assets";
import { CreateVault } from "./pages/CreateVault";
import { Landing } from "./pages/Landing";
import { Members } from "./pages/Members";
import { Overview } from "./pages/Overview";
import { Policies } from "./pages/Policies";
import { Security } from "./pages/Security";
import { Settings } from "./pages/Settings";
import { Simulator } from "./pages/Simulator";
import { Transactions } from "./pages/Transactions";
import { Welcome } from "./pages/Welcome";
import { ThemeContext, useThemeState } from "./state/theme";
import { useVaultAddress } from "./state/vaultAddress";

/**
 * Routes, patterned on safe.global -> app.safe.global:
 *   #/                landing (marketing)
 *   #/welcome         get started: connect, create or watch a vault
 *   #/new-vault       create flow
 *   #/app/<page>      the vault app (overview, assets, transactions, addressbook, members, settings, policies, security, simulator)
 */
type Route = { kind: "landing" } | { kind: "welcome" } | { kind: "create" } | { kind: "app"; page: AppPage };

const APP_PAGES: AppPage[] = ["overview", "assets", "transactions", "addressbook", "members", "settings", "policies", "security", "simulator"];
const LEGACY: Record<string, AppPage> = { home: "overview", recipients: "addressbook" };

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  if (raw === "" || raw === "/") return { kind: "landing" };
  if (raw === "welcome") return { kind: "welcome" };
  if (raw === "new-vault") return { kind: "create" };
  const seg = raw.replace(/^app\//, "");
  const page = (LEGACY[seg] ?? seg) as AppPage;
  if (APP_PAGES.includes(page)) return { kind: "app", page };
  return { kind: "landing" };
}

function go(route: Route) {
  const hash = route.kind === "landing" ? "#/" : route.kind === "welcome" ? "#/welcome" : route.kind === "create" ? "#/new-vault" : `#/app/${route.page}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  window.scrollTo({ top: 0 });
}

export default function App() {
  const themeState = useThemeState();
  const [route, setRoute] = useState<Route>(readRoute);
  const [vaultAddress, setVaultAddress] = useVaultAddress();
  const { data: vault, error, isLoading } = useVault(route.kind === "app" ? vaultAddress : null);
  const invalidate = useInvalidateVault(vaultAddress);
  const [flow, setFlow] = useState<{ open: boolean; asset?: `0x${string}` }>({ open: false });

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // The landing page is always light; the app follows the theme setting.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", route.kind === "landing" ? "light" : themeState.theme);
  }, [route.kind, themeState.theme]);

  const navigate = (page: AppPage) => go({ kind: "app", page });
  const openFlow = (asset?: `0x${string}`) => setFlow({ open: true, asset });
  const openVault = (a: `0x${string}`) => {
    setVaultAddress(a);
    go({ kind: "app", page: "overview" });
  };

  if (route.kind === "landing") return <Landing onLaunch={() => go({ kind: "welcome" })} />;

  return (
    <ThemeContext.Provider value={themeState}>
      {route.kind === "welcome" && <Welcome onOpen={openVault} onCreate={() => go({ kind: "create" })} onLanding={() => go({ kind: "landing" })} />}
      {route.kind === "create" && <CreateVault onCreated={openVault} onCancel={() => go({ kind: "welcome" })} />}
      {route.kind === "app" && (
        <>
          <AppShell page={route.page} onNavigate={navigate} onHome={() => go({ kind: "welcome" })} vault={vault} vaultAddress={vaultAddress} onNewTransaction={() => openFlow()} onSwitchVault={() => go({ kind: "welcome" })}>
            {route.page === "settings" ? (
              <Settings vault={vault} vaultAddress={vaultAddress} onSwitchVault={() => go({ kind: "welcome" })} />
            ) : route.page === "simulator" ? (
              <Simulator vault={vault} />
            ) : !vaultAddress ? (
              <Empty>No vault selected. <button className="link lime" onClick={() => go({ kind: "welcome" })}>Open one</button>.</Empty>
            ) : error ? (
              <div className="notice notice-bad">Could not read the vault: {(error as Error).message}</div>
            ) : isLoading || !vault ? (
              <Empty>Reading vault state from the chain…</Empty>
            ) : route.page === "overview" ? (
              <Overview vault={vault} onChanged={invalidate} onNavigate={navigate} onNewTransaction={() => openFlow()} />
            ) : route.page === "assets" ? (
              <Assets vault={vault} onSend={(a) => openFlow(a)} onNavigate={navigate} />
            ) : route.page === "transactions" ? (
              <Transactions vault={vault} onChanged={invalidate} onNewTransaction={() => openFlow()} />
            ) : route.page === "addressbook" ? (
              <AddressBook vault={vault} onChanged={invalidate} />
            ) : route.page === "members" ? (
              <Members vault={vault} onChanged={invalidate} />
            ) : route.page === "policies" ? (
              <Policies vault={vault} onChanged={invalidate} />
            ) : (
              <Security vault={vault} onChanged={invalidate} />
            )}
          </AppShell>
          {flow.open && vault && (
            <TxFlow vault={vault} presetAsset={flow.asset} onClose={() => setFlow({ open: false })} onChanged={() => { invalidate(); navigate("transactions"); }} />
          )}
        </>
      )}
    </ThemeContext.Provider>
  );
}
