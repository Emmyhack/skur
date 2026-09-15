import { useMemo, useState } from "react";
import { Badge, Section } from "../components/ui";
import { Reveal } from "../components/Reveal";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, parseAmount } from "../lib/format";
import { runScenarios, type Verdict } from "../lib/simulator";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import type { Policy } from "../lib/types";

const TONE: Record<Verdict, "ok" | "warn" | "bad" | "info"> = { blocked: "ok", impossible: "ok", delayed: "info", escalated: "warn", allowed: "bad" };
const TEXT: Record<Verdict, string> = { blocked: "Blocked", impossible: "Not possible", delayed: "Delayed", escalated: "Escalated", allowed: "Would succeed" };

/** Policy simulator: run a configured policy against the blueprint's attack scenarios. */
export function Simulator({ vault }: { vault: VaultData | undefined }) {
  const [source, setSource] = useState<"vault" | TemplateId>(vault ? "vault" : "startup");
  const [balanceText, setBalanceText] = useState("1,000,000");
  const [approvers, setApprovers] = useState(3);
  const [guardians, setGuardians] = useState(1);
  const stable = vault?.assets.find((a) => a.address !== "0x0000000000000000000000000000000000000000") ?? vault?.assets[0];
  const decimals = stable?.decimals ?? 6;
  const symbol = stable?.symbol ?? "USD";
  const { policy, limits } = useMemo(() => {
    if (source === "vault" && vault && stable) return { policy: vault.policy as Policy, limits: stable.limits };
    const t = TEMPLATES.find((x) => x.id === source) ?? TEMPLATES[0];
    return { policy: t.policy, limits: t.stable };
  }, [source, vault, stable]);
  const balance = source === "vault" && stable ? stable.balance : (parseAmount(balanceText, decimals) ?? 0n);
  const approverCount = source === "vault" && vault ? vault.counts.approvers : approvers;
  const guardianCount = source === "vault" && vault ? vault.counts.guardians : guardians;
  const results = useMemo(() => runScenarios({ policy, limits, balance, decimals, symbol, approverCount, guardianCount }), [policy, limits, balance, decimals, symbol, approverCount, guardianCount]);
  const stopped = results.filter((r) => r.verdict !== "allowed").length;
  const pct = Math.round((stopped / results.length) * 100);

  return (
    <>
      <div className="scorecard">
        <div>
          <div className="gauge">
            <div className="ring" style={{ ["--pct" as string]: pct }}><span>{stopped}/{results.length}</span></div>
            <div><div className="v" style={{ fontSize: 18 }}>Scenarios stopped or delayed</div><div className="l">verdicts use the contract's own rules</div></div>
          </div>
        </div>
        <div><div className="v">{results.filter((r) => r.verdict === "blocked" || r.verdict === "impossible").length}</div><div className="l">Blocked outright</div></div>
        <div><div className="v">{results.filter((r) => r.verdict === "delayed").length}</div><div className="l">Delayed with a veto window</div></div>
        <div><div className={`v ${results.some((r) => r.verdict === "allowed") ? "" : ""}`} style={{ color: results.some((r) => r.verdict === "allowed") ? "var(--error)" : undefined }}>{results.filter((r) => r.verdict === "allowed").length}</div><div className="l">Would succeed</div></div>
      </div>

      <Section title={<>Configuration under test<small>Pick the live policy or a template, then adjust the treasury size and team to see how the verdicts move.</small></>}>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <span className="field-label">Policy</span>
            <select value={source} onChange={(e) => setSource(e.target.value as "vault" | TemplateId)}>
              {vault && <option value="vault">Live vault (v{vault.policyVersion})</option>}
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} template</option>)}
            </select>
          </div>
          {source === "vault" && stable ? (
            <div className="field"><span className="field-label">Treasury balance</span><input value={fmtAmount(stable.balance, stable.decimals, stable.symbol)} readOnly /></div>
          ) : (
            <>
              <div className="field"><span className="field-label">Treasury balance ({symbol})</span><input value={balanceText} onChange={(e) => setBalanceText(e.target.value)} /></div>
              <div className="field"><span className="field-label">Approvers</span><input type="number" min={1} value={approvers} onChange={(e) => setApprovers(Number(e.target.value))} /></div>
              <div className="field"><span className="field-label">Guardians</span><input type="number" min={0} value={guardians} onChange={(e) => setGuardians(Number(e.target.value))} /></div>
            </>
          )}
        </div>
      </Section>

      <Reveal stagger>
        {results.map((r) => (
          <div key={r.id} className={`scenario ${r.verdict}`}>
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong style={{ fontSize: 16 }}>{r.title}</strong>
              <Badge tone={TONE[r.verdict]}>{TEXT[r.verdict]}</Badge>
            </div>
            <p className="muted" style={{ marginTop: 4 }}>{r.narrative}</p>
            <ul>{r.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
        ))}
      </Reveal>
      <p className="caption">Blocked and Not possible mean the contract refuses. Delayed means guardians get a veto window. Escalated means more approvals are needed but nothing waits. Would succeed is a gap to close before the policy goes live.</p>
    </>
  );
}
