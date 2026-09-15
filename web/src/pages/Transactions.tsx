import { useMemo, useState } from "react";
import { TxRow } from "../components/TxRow";
import { Button, Card, Empty, Tabs } from "../components/ui";
import type { VaultData } from "../hooks/useVault";
import { Kind, Mode, Status } from "../lib/types";

type Tab = "queue" | "history";
type Filter = "all" | "transfers" | "governance";

export function Transactions({ vault, onChanged, onNewTransaction }: { vault: VaultData; onChanged: () => void; onNewTransaction: () => void }) {
  const [tab, setTab] = useState<Tab>("queue");
  const [filter, setFilter] = useState<Filter>("all");
  const queue = useMemo(() => vault.proposals.filter((p) => p.status === Status.PENDING), [vault.proposals]);
  const history = useMemo(() => vault.proposals.filter((p) => p.status !== Status.PENDING), [vault.proposals]);
  const list = (tab === "queue" ? queue : history).filter((p) => (filter === "all" ? true : filter === "transfers" ? p.kind === Kind.TRANSFER : p.kind !== Kind.TRANSFER));
  const canPropose = vault.mode !== Mode.LOCKDOWN;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Every requirement shown here is computed by the vault contract, and re-checked at execution.</p>
        </div>
        <Button onClick={onNewTransaction} disabled={!canPropose} title={!canPropose ? "Vault is in Lockdown" : undefined}>
          New transaction
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "queue", label: "Queue", count: queue.length },
          { id: "history", label: "History" },
        ]}
      />
      <div className="inline" style={{ marginBottom: 12 }}>
        {(["all", "transfers", "governance"] as Filter[]).map((f) => (
          <button key={f} className={`pill ${filter === f ? "pill-brand" : "pill-neutral"}`} style={{ cursor: "pointer", border: 0 }} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "transfers" ? "Transfers" : "Governance & security"}
          </button>
        ))}
      </div>

      <Card flush>
        {vault.activityLoading ? (
          <Empty>Reading proposals and history from the chain…</Empty>
        ) : list.length === 0 ? (
          <Empty>{tab === "queue" ? "The queue is empty." : "No executed, cancelled or vetoed transactions yet."}</Empty>
        ) : (
          list.map((p) => <TxRow key={String(p.id)} p={p} vault={vault} onChanged={onChanged} />)
        )}
      </Card>
      {tab === "queue" && queue.length > 0 && (
        <p className="caption">Governance proposals need owner confirmations; security-reducing ones also wait for their timelock and can be vetoed by any guardian.</p>
      )}
    </>
  );
}
