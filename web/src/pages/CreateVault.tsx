import { useMemo, useState } from "react";
import { useAccount, useConnect, usePublicClient } from "wagmi";
import { isAddress, keccak256, stringToHex } from "viem";
import { SkurFactoryAbi } from "../abi/SkurFactory";
import { Button, Field, KV, TxStatus } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { IconWallet } from "../components/icons";
import { useTx } from "../hooks/useTx";
import { DEPLOYMENTS, NATIVE_ASSET } from "../config/chain";
import { fmtAmount, fmtDuration } from "../lib/format";
import { policyToContract, validateCounts, validatePolicy } from "../lib/policy";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER } from "../lib/types";
import { useVaultLabel } from "../state/vaultLabel";

type MemberRow = { address: string; roles: number };

/** app.safe.global/new-safe/create: numbered step card on the left, account preview on the right. */
export function CreateVault({ onCreated, onCancel }: { onCreated: (a: `0x${string}`) => void; onCancel: () => void }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const client = usePublicClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("startup");
  const template = TEMPLATES.find((t) => t.id === templateId)!;
  const [members, setMembers] = useState<MemberRow[]>([{ address: address ?? "", roles: ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR }, { address: "", roles: ROLE_OWNER | ROLE_APPROVER }, { address: "", roles: ROLE_GUARDIAN }]);
  const salt = useMemo(() => `vault-${Date.now()}`, []);
  const predicted = useMemo(() => (address ? keccak256(stringToHex(salt)) : null), [address, salt]);
  const [, setLabel] = useVaultLabel(null);
  const tx = useTx(async () => {
    if (!client || !address || !predicted) return;
    const v = await client.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "predictVaultAddress", args: [address, predicted] });
    try {
      const labels = JSON.parse(window.localStorage.getItem("skur.vaultLabels") ?? "{}");
      labels[v.toLowerCase()] = name || "Treasury vault";
      window.localStorage.setItem("skur.vaultLabels", JSON.stringify(labels));
    } catch {
      /* ignore */
    }
    setLabel(name);
    onCreated(v);
  });

  const counts = members.reduce(
    (a, m) => ({ owners: a.owners + (m.roles & 1 ? 1 : 0), approvers: a.approvers + (m.roles & 2 ? 1 : 0), executors: a.executors + (m.roles & 4 ? 1 : 0), guardians: a.guardians + (m.roles & 8 ? 1 : 0) }),
    { owners: 0, approvers: 0, executors: 0, guardians: 0 },
  );
  const errors = useMemo(() => {
    const e = [...validatePolicy(template.policy), ...validateCounts(template.policy, counts.owners, counts.approvers, counts.executors, counts.guardians)];
    const addrs = members.map((m) => m.address.toLowerCase());
    if (members.some((m) => !isAddress(m.address))) e.push("Every member needs a valid address.");
    if (new Set(addrs).size !== addrs.length) e.push("Duplicate member address.");
    if (members.some((m) => m.roles === 0)) e.push("Every member needs at least one role.");
    return e;
  }, [template, counts, members]);

  const setRow = (i: number, patch: Partial<MemberRow>) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggleRole = (i: number, b: number) =>
    setRow(i, { roles: b === ROLE_GUARDIAN ? (members[i].roles & ROLE_GUARDIAN ? 0 : ROLE_GUARDIAN) : ((members[i].roles & b ? members[i].roles & ~b : members[i].roles | b) & ~ROLE_GUARDIAN) });

  const create = () => {
    if (!predicted) return;
    tx.send({
      address: DEPLOYMENTS.factory,
      abi: SkurFactoryAbi,
      functionName: "createVault",
      args: [predicted, members.map((m) => m.address as `0x${string}`), members.map((m) => m.roles), policyToContract(template.policy), [DEPLOYMENTS.testUsd, NATIVE_ASSET], [template.stable, template.native]],
    });
  };

  const titles = ["Name and template", "Signers and guardians", "Review and sign"];
  const descs = ["Name the vault and choose the policy it starts with. Every number can be changed later through governance.", "Owners govern, approvers confirm payments, executors execute. Guardians can only freeze, veto and recover, and the contract will not let them hold a treasury role.", "This is the policy the vault will enforce from its first block. Check it, then sign once."];

  return (
    <div className="entry" style={{ background: "var(--canvas)" }}>
      <div className="entry-top">
        <button className="logo" onClick={onCancel} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}><span className="mark">S</span></button>
        <div className="tools-pill">
          {isConnected && address ? (
            <Button kind="secondary" className="on" icon={<Identicon address={address} size={18} />}>{address.slice(0, 6)}…{address.slice(-4)}</Button>
          ) : (
            connectors.slice(0, 1).map((c) => <Button key={c.uid} kind="secondary" onClick={() => connect({ connector: c })} disabled={isPending} icon={<IconWallet width={16} height={16} />}>Connect Wallet</Button>)
          )}
        </div>
      </div>
      <div className="create">
        <h1 style={{ marginBottom: 20 }}>Create new Skur vault</h1>
        <div className="create-grid">
          <div className="stepcard">
            <div className="progress"><i style={{ width: `${(step / 3) * 100}%` }} /></div>
            <div className="step-head">
              <span className="n">{step}</span>
              <div>
                <h3>{titles[step - 1]}</h3>
                <p>{descs[step - 1]}</p>
              </div>
            </div>
            <div className="step-body">
              {step === 1 && (
                <>
                  <Field label="Name" hint="Kept in this browser only. The chain knows the vault by its address.">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main treasury" maxLength={40} />
                  </Field>
                  <div className="field-label" style={{ marginBottom: 8 }}>Policy template</div>
                  <p className="caption" style={{ marginBottom: 12 }}>Pick the profile closest to your organisation. Every value can be tuned under Policies afterwards.</p>
                  <div className="templates">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} className={`template ${templateId === t.id ? "active" : ""}`} onClick={() => setTemplateId(t.id)}>
                        <strong>{t.name}</strong>
                        <span className="caption">{t.tagline}</span>
                      </button>
                    ))}
                  </div>
                  {!isConnected && (
                    <div className="notice notice-warn" style={{ marginTop: 20 }}>
                      <div>
                        <div className="strong">No wallet connected</div>
                        <div>Creating a vault is a transaction your wallet signs.</div>
                        <div style={{ marginTop: 10 }}>
                          {connectors.slice(0, 1).map((c) => <Button key={c.uid} size="sm" kind="secondary" onClick={() => connect({ connector: c })}>Connect</Button>)}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <table>
                    <thead>
                      <tr><th>Member</th><th>Owner</th><th>Approver</th><th>Executor</th><th>Guardian</th><th /></tr>
                    </thead>
                    <tbody>
                      {members.map((m, i) => (
                        <tr key={i}>
                          <td style={{ width: "48%" }}>
                            <div className="inline" style={{ flexWrap: "nowrap" }}>
                              {isAddress(m.address) ? <Identicon address={m.address} size={28} /> : <span className="token-ico" style={{ width: 28, height: 28 }}>?</span>}
                              <input value={m.address} onChange={(e) => setRow(i, { address: e.target.value.trim() })} placeholder="0x…" style={{ height: 40 }} />
                            </div>
                          </td>
                          {[ROLE_OWNER, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN].map((b) => (
                            <td key={b}><input type="checkbox" checked={Boolean(m.roles & b)} onChange={() => toggleRole(i, b)} /></td>
                          ))}
                          <td><Button kind="ghost" size="sm" onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>Remove</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 12 }}>
                    <Button kind="secondary" size="sm" onClick={() => setMembers((ms) => [...ms, { address: "", roles: ROLE_APPROVER }])}>+ Add member</Button>
                  </div>
                  <p className="caption" style={{ marginTop: 12 }}>
                    {counts.owners} owners · {counts.approvers} approvers · {counts.executors} executors · {counts.guardians} guardians. The {template.name} template needs {template.minSigners}+ signers and {template.minGuardians}+ guardian{template.minGuardians === 1 ? "" : "s"}.
                  </p>
                  {errors.length > 0 && <div className="notice notice-bad"><div>{errors.map((e) => <div key={e}>{e}</div>)}</div></div>}
                </>
              )}
              {step === 3 && (
                <>
                  <KV
                    rows={[
                      ["Name", name || "Treasury vault"],
                      ["Template", template.name],
                      ["Members", `${members.length} (${counts.guardians} guardian${counts.guardians === 1 ? "" : "s"})`],
                      ["Approvals by tier", `Low ${template.policy.approvalsLow} · High ${template.policy.approvalsHigh} · Critical ${template.policy.approvalsCritical} + ${template.policy.guardianThreshold} guardian`],
                      ["Delays", `High ${fmtDuration(template.policy.delayHigh)} · Critical ${fmtDuration(template.policy.delayCritical)} · New recipient ${fmtDuration(template.policy.recipientActivationDelay)}`],
                      ["Security-reducing change delay", fmtDuration(template.policy.policyChangeDelay)],
                      ["Loss envelope", `${template.policy.envelopeBps / 100}% of holdings per ${fmtDuration(template.policy.envelopeWindow)}, then Lockdown`],
                      ["sUSD limits", `routine ≤ ${fmtAmount(template.stable.lowMax, 6)} · per tx ≤ ${fmtAmount(template.stable.perTxMax, 6)} · daily ≤ ${fmtAmount(template.stable.dailyMax, 6)}`],
                      ["Network", "Ark Constellation devnet (9000)"],
                    ]}
                  />
                  <p className="caption" style={{ marginTop: 16 }}>The vault is a minimal proxy over the verified implementation. The factory that creates it keeps no authority over it; only the members listed above can act.</p>
                  <TxStatus state={tx.state} />
                </>
              )}
            </div>
            <div className="step-foot">
              <Button kind="secondary" onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as 1 | 2 | 3)}>{step === 1 ? "Cancel" : "Back"}</Button>
              {step < 3 ? (
                <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} disabled={!isConnected || (step === 2 && errors.length > 0)}>Next</Button>
              ) : (
                <Button onClick={create} disabled={!isConnected || errors.length > 0 || tx.busy}>Create vault</Button>
              )}
            </div>
          </div>

          <aside className="preview">
            <div className="wordmark-lg" style={{ fontSize: 20 }}><span className="mark" style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13 }}>S</span></div>
            <h4>Your vault preview</h4>
            {!isConnected ? (
              <>
                <p className="caption" style={{ marginBottom: 16 }}>Connect a wallet to see the preview</p>
                {connectors.slice(0, 1).map((c) => <Button key={c.uid} block onClick={() => connect({ connector: c })}>Connect</Button>)}
              </>
            ) : (
              <KV
                rows={[
                  ["Name", name || "Treasury vault"],
                  ["Network", "Ark devnet"],
                  ["Template", template.name],
                  ["Signers", `${counts.approvers} approvers · ${counts.owners} owners`],
                  ["Guardians", String(counts.guardians)],
                  ["Critical delay", fmtDuration(template.policy.delayCritical)],
                ]}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
