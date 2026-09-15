import { useEffect, useState } from "react";
import { Layout, type Page } from "./components/Layout";
import { TxFlow } from "./components/TxFlow";
import { Card, Empty } from "./components/ui";
import { useInvalidateVault, useVault } from "./hooks/useVault";
import { Assets } from "./pages/Assets";
import { Home } from "./pages/Home";
import { Members } from "./pages/Members";
import { Policies } from "./pages/Policies";
import { Recipients } from "./pages/Recipients";
import { Security } from "./pages/Security";
import { Settings } from "./pages/Settings";
import { Simulator } from "./pages/Simulator";
import { Transactions } from "./pages/Transactions";
import { ThemeContext, useThemeState } from "./state/theme";
import { useVaultAddress } from "./state/vaultAddress";

const PAGES: Page[] = ["home", "assets", "transactions", "recipients", "members", "policies", "security", "simulator", "settings"];

function readPage(): Page {
  const raw = window.location.hash.replace(/^#/, "").split("?")[0];
  const h = (raw === "overview" ? "home" : raw) as Page;
  return PAGES.includes(h) ? h : "home";
}

export default function App() {
  const themeState = useThemeState();
  const [page, setPage] = useState<Page>(readPage);
  const [vaultAddress, setVaultAddress] = useVaultAddress();
  const { data: vault, error, isLoading } = useVault(vaultAddress);
  const invalidate = useInvalidateVault(vaultAddress);
  const [flow, setFlow] = useState<{ open: boolean; asset?: `0x${string}` }>({ open: false });

  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  const openFlow = (asset?: `0x${string}`) => setFlow({ open: true, asset });

  let body: React.ReactNode;
  if (page === "settings") {
    body = <Settings vaultAddress={vaultAddress} onSelect={(a) => { setVaultAddress(a); if (a) navigate("home"); }} />;
  } else if (page === "simulator") {
    body = <Simulator vault={vault} />;
  } else if (!vaultAddress) {
    body = (
      <Card title="No vault selected">
        <Empty>
          Open a vault or create one under{" "}
          <button className="link brand" onClick={() => navigate("settings")}>Settings</button>.
        </Empty>
      </Card>
    );
  } else if (error) {
    body = <div className="notice notice-bad">Could not read the vault: {(error as Error).message}</div>;
  } else if (isLoading || !vault) {
    body = <Empty>Reading vault state from the chain…</Empty>;
  } else if (page === "home") {
    body = <Home vault={vault} onChanged={invalidate} onNavigate={navigate} onNewTransaction={() => openFlow()} />;
  } else if (page === "assets") {
    body = <Assets vault={vault} onSend={(a) => openFlow(a)} onNavigate={navigate} />;
  } else if (page === "transactions") {
    body = <Transactions vault={vault} onChanged={invalidate} onNewTransaction={() => openFlow()} />;
  } else if (page === "recipients") {
    body = <Recipients vault={vault} onChanged={invalidate} />;
  } else if (page === "members") {
    body = <Members vault={vault} onChanged={invalidate} />;
  } else if (page === "policies") {
    body = <Policies vault={vault} onChanged={invalidate} />;
  } else {
    body = <Security vault={vault} onChanged={invalidate} />;
  }

  return (
    <ThemeContext.Provider value={themeState}>
      <Layout page={page} onNavigate={navigate} vault={vault} vaultAddress={vaultAddress} onNewTransaction={() => openFlow()}>
        {body}
      </Layout>
      {flow.open && vault && (
        <TxFlow
          vault={vault}
          presetAsset={flow.asset}
          onClose={() => setFlow({ open: false })}
          onChanged={() => {
            invalidate();
            navigate("transactions");
          }}
        />
      )}
    </ThemeContext.Provider>
  );
}
