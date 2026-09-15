import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { isAddress, stringToHex } from "viem";
import { useQuery } from "@tanstack/react-query";
import { SkurVaultAbi } from "../abi/SkurVault";
import { Address, Button, Card, Field, KV, ModeBadge, TxLink, TxStatus } from "../components/ui";
import { useTx } from "../hooks/useTx";
import type { VaultData } from "../hooks/useVault";
import { fmtAmount, fmtDuration } from "../lib/format";
import { computeMaxLoss } from "../lib/maxLoss";
import { Mode, MODE_LABEL, ROLE_GUARDIAN, ROLE_OWNER, roleNames } from "../lib/types";
import { Identicon } from "../components/Identicon";

export function Security({ vault, onChanged }: { vault: VaultData; onChanged: () => void }) {
  const { address } = useAccount();
  const me = vault.members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
  const roles = me?.roles ?? 0;
  const tx = useTx(onChanged);
  const [reason, setReason] = useState("");
  const [oldSigner, setOldSigner] = useState("");
  const [newSigner, setNewSigner] = useState("");
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);

  const call = (functionName: string, args: readonly unknown[]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName, args });
  const r32 = stringToHex(reason.slice(0, 31) || "manual", { size: 32 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Security</h1>
          <p>Guardians, security modes, recovery and the maximum-loss view.</p>
        </div>
        <ModeBadge mode={vault.mode} />
      </div>

      <div className="grid grid-2">
        <Card title="Security mode" subtitle="Owners and guardians can raise the mode instantly. Lowering it is governance plus guardian confirmation; leaving Lockdown also waits for the policy-change delay.">
          <KV
            rows={[
              ["Current", MODE_LABEL[vault.mode]],
              ["Elevated", "every transfer is one tier higher; per-transaction and daily caps are halved"],
              ["Lockdown", "no outgoing execution, no security-reducing changes; deposits, tightening, recovery and guardians keep working"],
            ]}
          />
          <div style={{ height: 16 }} />
          <Field label="Reason (recorded onchain, 31 characters)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="phishing incident" maxLength={31} />
          </Field>
          <div className="inline">
            {vault.mode < Mode.ELEVATED && (
              <Button kind="secondary" disabled={!(roles & (ROLE_OWNER | ROLE_GUARDIAN)) || tx.busy} onClick={() => call("raiseMode", [Mode.ELEVATED, r32])}>
                Raise to Elevated
              </Button>
            )}
            {vault.mode < Mode.LOCKDOWN && (
              <Button kind="danger" disabled={!(roles & (ROLE_OWNER | ROLE_GUARDIAN)) || tx.busy} onClick={() => call("raiseMode", [Mode.LOCKDOWN, r32])}>
                Freeze vault
              </Button>
            )}
            {vault.mode > Mode.NORMAL && (
              <Button disabled={!(roles & ROLE_OWNER) || tx.busy} onClick={() => call("proposeModeRelax", [vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL])}>
                Propose lowering to {vault.mode === Mode.LOCKDOWN ? "Elevated" : "Normal"}
              </Button>
            )}
          </div>
          <TxStatus state={tx.state} />
        </Card>

        <Card title="Guardians" subtitle="An independent control plane. Guardians cannot move funds.">
          {guardians.length === 0 ? (
            <div className="notice notice-bad">No guardian configured. Critical transfers cannot be confirmed and nobody independent can veto.</div>
          ) : (
            <ul className="list" style={{ margin: "0 -24px" }}>
              {guardians.map((g) => (
                <li key={g.address}>
                  <Identicon address={g.address} size={32} />
                  <div className="grow">
                    <div className="title"><Address value={g.address} copy /></div>
                    <div className="sub">{roleNames(g.roles).join(", ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="caption" style={{ marginTop: 12 }}>
            Veto: any single guardian. Confirmations and recovery: {vault.policy.guardianThreshold} of {guardians.length}.
          </p>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Recovery" subtitle={`Guardians replace a lost or compromised signer with a new address holding the same roles. Executes after ${fmtDuration(vault.policy.recoveryDelay)}; any owner can cancel during the delay; the vault moves to Elevated when it completes.`}>
          <div className="row">
            <Field label="Signer to replace">
              <input value={oldSigner} onChange={(e) => setOldSigner(e.target.value.trim())} placeholder="0x…" list="members" />
              <datalist id="members">
                {vault.members.map((m) => (
                  <option key={m.address} value={m.address}>
                    {roleNames(m.roles).join("+")}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="New signer">
              <input value={newSigner} onChange={(e) => setNewSigner(e.target.value.trim())} placeholder="0x…" />
            </Field>
          </div>
          <Button disabled={!(roles & ROLE_GUARDIAN) || !isAddress(oldSigner) || !isAddress(newSigner) || tx.busy} onClick={() => call("proposeRecovery", [oldSigner as `0x${string}`, newSigner as `0x${string}`])}>
            Propose recovery
          </Button>
        </Card>

        <MaxLoss vault={vault} />
      </div>

      <Card title="Security posture" subtitle="Obvious weaknesses and confirmed controls. This does not measure absolute security.">
        <Posture vault={vault} />
      </Card>

      <Card flush title="Mode history">
        {vault.modeHistory.length === 0 ? (
          <Empty>No mode changes recorded.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Change</th>
                <th>By</th>
                <th>Reason</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {[...vault.modeHistory].reverse().map((h, i) => (
                <tr key={i}>
                  <td>{MODE_LABEL[h.previous]} → {MODE_LABEL[h.mode]}</td>
                  <td><Address value={h.by} /></td>
                  <td>{h.reason}</td>
                  <td><TxLink hash={h.txHash} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

function MaxLoss({ vault }: { vault: VaultData }) {
  const first = vault.assets[0];
  return (
    <Card title="Maximum possible loss" subtitle="Conservative upper bound per asset under the stated assumptions. Never a guarantee.">
      {vault.assets.map((a) => {
        const l = computeMaxLoss(vault.policy, a.limits, a.balance, vault.mode);
        return (
          <div key={a.address} style={{ marginBottom: 16 }}>
            <div className="overline" style={{ marginBottom: 4 }}>{a.symbol}</div>
            <KV
              rows={[
                ["Could leave with no delay", `${fmtAmount(l.immediate, a.decimals, a.symbol)} (${l.immediateBinding})`],
                ["Could leave within 24h", `${fmtAmount(l.day, a.decimals, a.symbol)} (${l.dayBinding})`],
                ["Critical withdrawals wait", fmtDuration(l.criticalDelay)],
                ["High-risk withdrawals wait", fmtDuration(l.highDelay)],
              ]}
            />
          </div>
        );
      })}
      {first && (
        <ul className="assumptions">
          {computeMaxLoss(vault.policy, first.limits, first.balance, vault.mode).assumptions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export type PostureItem = { ok: "ok" | "warn" | "bad"; text: string };

/** Pure posture checks from policy and membership. The EOA check needs the chain and lives in the component. */
export function postureItems(vault: VaultData): PostureItem[] {
  const p = vault.policy;
  const g = vault.counts.guardians;
  return [
    { ok: g > 0 ? "ok" : "bad", text: g > 0 ? `${g} independent guardian${g === 1 ? "" : "s"} configured` : "No guardian: nobody independent can veto or freeze" },
    { ok: p.guardianRequiredCritical ? "ok" : "warn", text: p.guardianRequiredCritical ? "Critical transfers need guardian confirmation" : "Critical transfers do not need a guardian" },
    { ok: p.delayCritical >= 24 * 3600 ? "ok" : "warn", text: `Critical delay ${fmtDuration(p.delayCritical)}` },
    { ok: p.recipientActivationDelay > 0 ? "ok" : "bad", text: p.recipientActivationDelay > 0 ? `New recipients wait ${fmtDuration(p.recipientActivationDelay)}` : "New recipients can be paid immediately" },
    { ok: vault.assets.every((a) => a.limits.dailyMax > 0n) ? "ok" : "warn", text: vault.assets.every((a) => a.limits.dailyMax > 0n) ? "24h outflow cap on every asset" : "Some assets have no 24h cap" },
    { ok: p.envelopeBps > 0 ? "ok" : "warn", text: p.envelopeBps > 0 ? `Circuit breaker at ${p.envelopeBps / 100}% per ${fmtDuration(p.envelopeWindow)}` : "No loss envelope configured" },
    { ok: p.policyChangeDelay > 0 ? "ok" : "bad", text: p.policyChangeDelay > 0 ? `Security-reducing changes wait ${fmtDuration(p.policyChangeDelay)}` : "Policy can be weakened instantly" },
    { ok: p.recoveryDelay > 0 && g > 0 ? "ok" : "warn", text: `Recovery configured (${fmtDuration(p.recoveryDelay)} delay)` },
    { ok: p.approvalsLow >= 2 ? "ok" : "warn", text: p.approvalsLow >= 2 ? "Routine payments need two approvals" : "Routine payments need a single approval" },
  ];
}

/** Security posture indicator: confirmed controls and obvious weaknesses. */
export function Posture({ vault, compact = false }: { vault: VaultData; compact?: boolean }) {
  const client = usePublicClient();
  const signers = vault.members.filter((m) => !(m.roles & ROLE_GUARDIAN));
  const { data: codeMap } = useQuery({
    queryKey: ["codes", vault.address, signers.map((s) => s.address).join(",")],
    queryFn: async () => {
      const out: Record<string, boolean> = {};
      await Promise.all(
        signers.map(async (s) => {
          const code = await client!.getCode({ address: s.address }).catch(() => undefined);
          out[s.address.toLowerCase()] = Boolean(code && code !== "0x");
        }),
      );
      return out;
    },
    enabled: Boolean(client),
    staleTime: 60_000,
  });
  const eoaSigners = codeMap ? signers.filter((s) => !codeMap[s.address.toLowerCase()]).length : null;
  const items = postureItems(vault);
  if (eoaSigners !== null) {
    items.push({ ok: eoaSigners === 0 ? "ok" : "warn", text: eoaSigners === 0 ? "All signers are smart-contract accounts" : `${eoaSigners} of ${signers.length} signers are externally-owned keys` });
  }
  return (
    <ul className={`posture ${compact ? "small" : ""}`}>
      {items.map((i) => (
        <li key={i.text}>
          <span className={`dot ${i.ok}`} />
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  );
}
