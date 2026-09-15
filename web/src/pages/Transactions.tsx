import { useMemo, useState } from "react";
import { TxRow } from "../components/TxRow";
import { Button, Empty } from "../components/ui";
import { IconTx } from "../components/icons";
import type { ProposalView, VaultData } from "../hooks/useVault";
import { Kind, Mode, Status } from "../lib/types";

type Tab = "queue" | "history";
type Filter = "all" | "transfers" | "governance";

function dayLabel(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

function groupByDay(list: ProposalView[]): Array<[string, ProposalView[]]> {
  const out: Array<[string, ProposalView[]]> = [];
  for (const p of list) {
    const label = dayLabel(p.createdAt);
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(p);
    else out.push([label, [p]]);
  }
  return out;
}

/** app.safe.global/transactions: Queue / History tabs, date-grouped card rows. */
export function Transactions({ vault, onChanged, onNewTransaction }: { vault: VaultData; onChanged: () => void; onNewTransaction: () => void }) {
  const [tab, setTab] = useState<Tab>("queue");
  const [filter, setFilter] = useState<Filter>("all");
  const queue = useMemo(() => vault.proposals.filter((p) => p.status === Status.PENDING), [vault.proposals]);
  const history = useMemo(() => vault.proposals.filter((p) => p.status !== Status.PENDING), [vault.proposals]);
  const list = (tab === "queue" ? queue : history).filter((p) => (filter === "all" ? true : filter === "transfers" ? p.kind === Kind.TRANSFER : p.kind !== Kind.TRANSFER));
  const groups = groupByDay(list);

  return (
    <>
      <div className="tabs-row">
        <div className="tabs">
          <button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}>Queue {queue.length > 0 && <span className="pill pill-review">{queue.length}</span>}</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
        </div>
        <div className="inline">
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ height: 40, width: "auto" }}>
            <option value="all">All types</option>
            <option value="transfers">Transfers</option>
            <option value="governance">Governance & security</option>
          </select>
          <Button kind="secondary" onClick={onNewTransaction} disabled={vault.mode === Mode.LOCKDOWN}>New transaction</Button>
        </div>
      </div>

      {vault.logsFailed && <div className="notice notice-warn" style={{ marginBottom: 16 }}>The chain's event log could not be read, so purposes and history details are missing. Proposals below come straight from contract state.</div>}
      {vault.activityLoading ? (
        <Empty>Reading proposals and history from the chain…</Empty>
      ) : list.length === 0 ? (
        <div className="card flush">
          <Empty icon={<IconTx width={40} height={40} />}>{tab === "queue" ? "Proposals waiting for confirmation or execution will appear here" : "Executed, cancelled and vetoed proposals will appear here"}</Empty>
        </div>
      ) : (
        groups.map(([label, items]) => (
          <div key={label}>
            <div className="date-label">{label}</div>
            {items.map((p) => <TxRow key={String(p.id)} p={p} vault={vault} onChanged={onChanged} />)}
          </div>
        ))
      )}
      {tab === "queue" && queue.length > 0 && <p className="caption" style={{ marginTop: 12 }}>Governance proposals need owner confirmations. Security-reducing ones also wait out their timelock, and any guardian can veto them.</p>}
    </>
  );
}
