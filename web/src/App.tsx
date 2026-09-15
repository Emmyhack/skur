import { useEffect, useState } from "react";
import { Layout, type Page } from "./components/Layout";
import { Card, Empty } from "./components/ui";
import { useInvalidateVault, useVault } from "./hooks/useVault";
import { Members } from "./pages/Members";
import { Overview } from "./pages/Overview";
import { Policies } from "./pages/Policies";
import { Recipients } from "./pages/Recipients";
import { Security } from "./pages/Security";
import { Settings } from "./pages/Settings";
import { Simulator } from "./pages/Simulator";
import { Transactions } from "./pages/Transactions";
import { useVaultAddress } from "./state/vaultAddress";

const PAGES: Page[] = ["overview", "transactions", "recipients", "members", "policies", "security", "simulator", "settings"];

function readPage(): Page {
  const h = window.location.hash.replace(/^#/, "").split("?")[0] as Page;
  return PAGES.includes(h) ? h : "overview";
}

export default function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [vaultAddress, setVaultAddress] = useVaultAddress();
  const { data: vault, error, isLoading } = useVault(vaultAddress);
  const invalidate = useInvalidateVault(vaultAddress);

  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
  };

  let body: React.ReactNode;
  if (page === "settings") {
    body = <Settings vaultAddress={vaultAddress} onSelect={(a) => { setVaultAddress(a); if (a) navigate("overview"); }} />;
  } else if (page === "simulator") {
    body = <Simulator vault={vault} />;
  } else if (!vaultAddress) {
    body = (
      <Card title="No vault selected">
        <Empty>
          Open a vault or create one under <a href="#settings" onClick={(e) => { e.preventDefault(); navigate("settings"); }}>Settings</a>.
        </Empty>
      </Card>
    );
  } else if (error) {
    body = <div className="notice notice-bad">Could not read the vault: {(error as Error).message}</div>;
  } else if (isLoading || !vault) {
    body = <Empty>Reading vault state from the chain…</Empty>;
  } else if (page === "overview") {
    body = <Overview vault={vault} onChanged={invalidate} onNavigate={navigate} />;
  } else if (page === "transactions") {
    body = <Transactions vault={vault} onChanged={invalidate} />;
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
    <Layout page={page} onNavigate={navigate} vault={vault} vaultAddress={vaultAddress}>
      {body}
    </Layout>
  );
}
