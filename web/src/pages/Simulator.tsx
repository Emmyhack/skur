import { useMemo, useState } from "react";
import { Badge, Card, Field } from "../components/ui";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, parseAmount } from "../lib/format";
import { runScenarios, type Verdict } from "../lib/simulator";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import type { Policy } from "../lib/types";

const VERDICT_TONE: Record<Verdict, "ok" | "warn" | "bad" | "info"> = {
  blocked: "ok",
  impossible: "ok",
  delayed: "info",
  escalated: "warn",
  allowed: "bad",
};
const VERDICT_TEXT: Record<Verdict, string> = {
  blocked: "Blocked",
  impossible: "Not possible",
  delayed: "Delayed",
  escalated: "Escalated",
  allowed: "Would succeed",
};

export function Simulator({ vault }: { vault: VaultData | undefined }) {
  const [source, setSource] = useState<"vault" | TemplateId>(vault ? "vault" : "startup");
  const [balanceText, setBalanceText] = useState("1,000,000");
  const [approvers, setApprovers] = useState(3);
  const [guardians, setGuardians] = useState(1);

  const stable = vault?.assets.find((a) => a.address !== "0x0000000000000000000000000000000000000000") ?? vault?.assets[0];
  const decimals = stable?.decimals ?? 6;
  const symbol = stable?.symbol ?? "USD";

  const { policy, limits }: { policy: Policy; limits: NonNullable<typeof stable>["limits"] } = useMemo(() => {
    if (source === "vault" && vault && stable) return { policy: vault.policy, limits: stable.limits };
    const t = TEMPLATES.find((x) => x.id === source) ?? TEMPLATES[0];
    return { policy: t.policy, limits: t.stable };
  }, [source, vault, stable]);

  const balance = source === "vault" && stable ? stable.balance : (parseAmount(balanceText, decimals) ?? 0n);
  const approverCount = source === "vault" && vault ? vault.counts.approvers : approvers;
  const guardianCount = source === "vault" && vault ? vault.counts.guardians : guardians;

  const results = useMemo(
    () => runScenarios({ policy, limits, balance, decimals, symbol, approverCount, guardianCount }),
    [policy, limits, balance, decimals, symbol, approverCount, guardianCount],
  );
  const blockedOrDelayed = results.filter((r) => r.verdict !== "allowed").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Policy simulator</h1>
          <p className="muted">Runs a policy against the attack scenarios from the security blueprint. Verdicts come from the same deterministic rules the contract enforces; nothing here is heuristic.</p>
        </div>
        <Badge tone={blockedOrDelayed === results.length ? "ok" : "warn"}>
          {blockedOrDelayed} of {results.length} scenarios stopped or delayed
        </Badge>
      </div>

      <Card title="Configuration under test">
        <div className="row">
          <Field label="Policy">
            <select value={source} onChange={(e) => setSource(e.target.value as "vault" | TemplateId)}>
              {vault && <option value="vault">Live vault (v{vault.policyVersion})</option>}
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} template
                </option>
              ))}
            </select>
          </Field>
          {source === "vault" && stable ? (
            <Field label="Treasury balance">
              <input value={fmtAmount(stable.balance, stable.decimals, stable.symbol)} readOnly />
            </Field>
          ) : (
            <>
              <Field label={`Treasury balance (${symbol})`}>
                <input value={balanceText} onChange={(e) => setBalanceText(e.target.value)} />
              </Field>
              <Field label="Approvers">
                <input type="number" min={1} value={approvers} onChange={(e) => setApprovers(Number(e.target.value))} />
              </Field>
              <Field label="Guardians">
                <input type="number" min={0} value={guardians} onChange={(e) => setGuardians(Number(e.target.value))} />
              </Field>
            </>
          )}
        </div>
      </Card>

      {results.map((r) => (
        <div key={r.id} className={`scenario ${r.verdict}`}>
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <strong>{r.title}</strong>
            <Badge tone={VERDICT_TONE[r.verdict]}>{VERDICT_TEXT[r.verdict]}</Badge>
          </div>
          <p className="muted small">{r.narrative}</p>
          <ul className="small">
            {r.detail.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="small muted">"Blocked" and "Not possible" mean the contract refuses. "Delayed" means guardians get a veto window. "Escalated" means more approvals are needed but no delay applies. "Would succeed" is a gap to fix before activating the policy.</p>
    </>
  );
}
