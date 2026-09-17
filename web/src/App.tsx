import { useEffect, useState } from "react";
import { AppShell, type AppPage } from "./components/AppShell";
import { Skeleton } from "./components/Reveal";
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
import { Product } from "./pages/Product";
import { Security } from "./pages/Security";
import { SecurityPage } from "./pages/SecurityPage";
import { Mobile } from "./pages/Mobile";
import { Docs, DOC_SLUGS, type DocSlug } from "./pages/Docs";
import { Settings } from "./pages/Settings";
import { Simulator } from "./pages/Simulator";
import { Solutions } from "./pages/Solutions";
import { Transactions } from "./pages/Transactions";
import { Welcome } from "./pages/Welcome";
import { ThemeContext, useThemeState } from "./state/theme";
import { useVaultAddress } from "./state/vaultAddress";

/**
 * Routes, patterned on safe.global -> app.safe.global:
 *   #/  #/product  #/solutions  #/security  #/mobile   marketing
 *   #/welcome  #/new-vault                     onboarding
 *   #/app/<page>                               the vault app
 */
type Route = { kind: "landing" } | { kind: "product" } | { kind: "solutions" } | { kind: "securitypage" } | { kind: "mobile" } | { kind: "docs"; slug: DocSlug } | { kind: "welcome" } | { kind: "create" } | { kind: "app"; page: AppPage };

const APP_PAGES: AppPage[] = ["overview", "assets", "transactions", "addressbook", "members", "settings", "policies", "security", "simulator"];
const LEGACY: Record<string, AppPage> = { home: "overview", recipients: "addressbook" };

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0].split("#")[0];
  if (raw === "" || raw === "/") return { kind: "landing" };
  if (raw === "product") return { kind: "product" };
  if (raw === "solutions") return { kind: "solutions" };
  if (raw === "security") return { kind: "securitypage" };
  if (raw === "mobile") return { kind: "mobile" };
  if (raw === "docs" || raw.startsWith("docs/")) {
    const slug = raw.slice(5) as DocSlug;
    return { kind: "docs", slug: DOC_SLUGS.includes(slug) ? slug : "introduction" };
  }
  if (raw === "welcome") return { kind: "welcome" };
  if (raw === "new-vault") return { kind: "create" };
  const seg = raw.replace(/^app\//, "");
  const page = (LEGACY[seg] ?? seg) as AppPage;
  if (APP_PAGES.includes(page)) return { kind: "app", page };
  return { kind: "landing" };
}

function go(route: Route) {
  const hash = route.kind === "landing" ? "#/" : route.kind === "product" ? "#/product" : route.kind === "solutions" ? "#/solutions" : route.kind === "securitypage" ? "#/security" : route.kind === "mobile" ? "#/mobile" : route.kind === "docs" ? `#/docs/${route.slug}` : route.kind === "welcome" ? "#/welcome" : route.kind === "create" ? "#/new-vault" : `#/app/${route.page}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  window.scrollTo({ top: 0 });
}

function LoadingVault() {
  return (
    <div className="overview-grid">
      <div>
        <div className="card"><Skeleton w={120} h={14} /><Skeleton w={280} h={40} style={{ marginTop: 10 }} /><Skeleton w={220} h={12} style={{ marginTop: 10 }} /></div>
        <div className="card"><Skeleton w={100} h={14} /><Skeleton h={48} style={{ marginTop: 14 }} /><Skeleton h={48} style={{ marginTop: 8 }} /></div>
      </div>
      <div>
        <div className="card"><Skeleton w={160} h={14} /><Skeleton h={60} style={{ marginTop: 14 }} /></div>
        <div className="card"><Skeleton w={120} h={14} /><Skeleton h={14} style={{ marginTop: 14 }} /><Skeleton h={14} style={{ marginTop: 8 }} /><Skeleton h={14} style={{ marginTop: 8 }} /></div>
      </div>
    </div>
  );
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

  useEffect(() => { window.scrollTo(0, 0); }, [route.kind, "page" in route ? route.page : "", "slug" in route ? route.slug : ""]);
  const marketing = route.kind === "landing" || route.kind === "product" || route.kind === "solutions" || route.kind === "securitypage" || route.kind === "mobile" || route.kind === "docs";
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", marketing ? "light" : themeState.theme);
  }, [marketing, themeState.theme]);

  const navigate = (page: AppPage) => go({ kind: "app", page });
  const openFlow = (asset?: `0x${string}`) => setFlow({ open: true, asset });
  const openVault = (a: `0x${string}`) => { setVaultAddress(a); go({ kind: "app", page: "overview" }); };
  const launch = () => go({ kind: "welcome" });

  if (route.kind === "landing") return <Landing onLaunch={launch} />;
  if (route.kind === "product") return <Product onLaunch={launch} />;
  if (route.kind === "solutions") return <Solutions onLaunch={launch} />;
  if (route.kind === "securitypage") return <SecurityPage onLaunch={launch} />;
  if (route.kind === "mobile") return <Mobile onLaunch={launch} />;
  if (route.kind === "docs") return <Docs slug={route.slug} onLaunch={launch} onNavigate={(s) => { window.location.hash = `#/docs/${s}`; }} />;

  return (
    <ThemeContext.Provider value={themeState}>
      {route.kind === "welcome" && <Welcome onOpen={openVault} onCreate={() => go({ kind: "create" })} onLanding={() => go({ kind: "landing" })} />}
      {route.kind === "create" && <CreateVault onCreated={openVault} onCancel={() => go({ kind: "welcome" })} />}
      {route.kind === "app" && (
        <>
          <AppShell page={route.page} onNavigate={navigate} onHome={launch} vault={vault} vaultAddress={vaultAddress} onNewTransaction={() => openFlow()} onSwitchVault={launch}>
            <div className="page-enter" key={route.page}>
              {route.page === "settings" ? (
                <Settings vault={vault} vaultAddress={vaultAddress} onSwitchVault={launch} />
              ) : route.page === "simulator" ? (
                <Simulator vault={vault} />
              ) : !vaultAddress ? (
                <Empty>No vault selected. <button className="link accent" onClick={launch}>Open one</button>.</Empty>
              ) : error ? (
                <div className="notice notice-bad">Could not read the vault: {(error as Error).message}</div>
              ) : isLoading || !vault ? (
                <LoadingVault />
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
            </div>
          </AppShell>
          {flow.open && vault && <TxFlow vault={vault} presetAsset={flow.asset} onClose={() => setFlow({ open: false })} onChanged={() => { invalidate(); navigate("transactions"); }} />}
        </>
      )}
    </ThemeContext.Provider>
  );
}
