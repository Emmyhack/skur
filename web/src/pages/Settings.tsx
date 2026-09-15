import { useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { isAddress, keccak256, stringToHex } from "viem";
import { SkurFactoryAbi } from "../abi/SkurFactory";
import { Address, Badge, Button, Card, Field, KV, Switch, TxStatus } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { useTx } from "../hooks/useTx";
import { ARK_DEVNET_EXPLORER, ARK_DEVNET_FAUCET, ARK_DEVNET_RPC, DEPLOYMENTS, NATIVE_ASSET } from "../config/chain";
import { fmtDuration, short } from "../lib/format";
import { validateCounts, validatePolicy, policyToContract } from "../lib/policy";
import { TEMPLATES, type TemplateId } from "../lib/templates";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER } from "../lib/types";
import { useTheme } from "../state/theme";
import { useVaultLabel } from "../state/vaultLabel";

export function Settings({ vaultAddress, onSelect }: { vaultAddress: `0x${string}` | null; onSelect: (a: `0x${string}` | null) => void }) {
  const [input, setInput] = useState(vaultAddress ?? "");
  const client = usePublicClient();
  const { address } = useAccount();
  const [checking, setChecking] = useState<string | null>(null);
  const { theme, toggle } = useTheme();
  const [label, setLabel] = useVaultLabel(vaultAddress);

  const select = async () => {
    if (!isAddress(input) || !client) return;
    setChecking("Checking the factory registry…");
    const ok = await client.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "isVault", args: [input as `0x${string}`] }).catch(() => false);
    setChecking(ok ? null : "This address is not registered by the Skur factory on this chain. It was selected anyway; reads may fail.");
    onSelect(input as `0x${string}`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Vault selection, appearance, network, and vault creation. Nothing here is stored anywhere except this browser.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title="Vault" subtitle="Open any Skur vault by address. The name is private to this browser; the chain only knows the address.">
          {vaultAddress && (
            <div className="inline" style={{ marginBottom: 16, gap: 12 }}>
              <Identicon address={vaultAddress} size={40} />
              <div style={{ flex: 1 }}>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Treasury vault" maxLength={40} style={{ height: 36 }} />
              </div>
            </div>
          )}
          <Field label="Vault address">
            <input value={input} onChange={(e) => setInput(e.target.value.trim())} placeholder="0x…" />
          </Field>
          <div className="inline">
            <Button onClick={select} disabled={!isAddress(input)}>Open vault</Button>
            {DEPLOYMENTS.demoVault && (
              <Button kind="secondary" onClick={() => { setInput(DEPLOYMENTS.demoVault); onSelect(DEPLOYMENTS.demoVault); }}>
                Use demo vault
              </Button>
            )}
            {vaultAddress && <Button kind="ghost" onClick={() => onSelect(null)}>Clear</Button>}
          </div>
          {checking && <div className="notice notice-warn">{checking}</div>}
          <MyVaults onSelect={(a) => { setInput(a); onSelect(a); }} me={address} />
        </Card>

        <div>
          <Card title="Appearance">
            <Switch on={theme === "dark"} onChange={toggle} label={theme === "dark" ? "Dark mode" : "Light mode"} />
          </Card>
          <Card title="Network" subtitle="If this interface disappears, the vault stays reachable through these endpoints and the verified contracts.">
            <KV
              rows={[
                ["Chain", "Ark Constellation devnet · 9000 · KASH"],
                ["RPC", <code key="rpc">{ARK_DEVNET_RPC}</code>],
                ["Explorer", <a key="ex" className="link brand" href={ARK_DEVNET_EXPLORER} target="_blank" rel="noreferrer">Blockscout</a>],
                ["Faucet", <a key="f" className="link brand" href={ARK_DEVNET_FAUCET} target="_blank" rel="noreferrer">Request devnet KASH</a>],
                ["Factory", <Address key="fa" value={DEPLOYMENTS.factory} />],
                ["Vault implementation", <Address key="im" value={DEPLOYMENTS.vaultImplementation} />],
                ["Test stablecoin (sUSD)", <Address key="us" value={DEPLOYMENTS.testUsd} />],
              ]}
            />
          </Card>
        </div>
      </div>

      <CreateVault onCreated={(a) => { setInput(a); onSelect(a); }} />
    </>
  );
}

function MyVaults({ me, onSelect }: { me?: `0x${string}`; onSelect: (a: `0x${string}`) => void }) {
  const client = usePublicClient();
  const [list, setList] = useState<`0x${string}`[] | null>(null);
  const load = async () => {
    if (!client || !me) return;
    const v = await client.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [me] }).catch(() => []);
    setList([...v]);
  };
  if (!me) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <button className="link brand" onClick={load}>Find vaults created with my address</button>
      {list && (list.length === 0 ? <p className="caption">None found in the factory registry.</p> : list.map((a) => (
        <div key={a} className="inline" style={{ padding: "6px 0" }}>
          <Identicon address={a} size={24} />
          <Address value={a} />
          <Button kind="ghost" size="sm" onClick={() => onSelect(a)}>Open</Button>
        </div>
      )))}
    </div>
  );
}

type MemberRow = { address: string; roles: number };

function CreateVault({ onCreated }: { onCreated: (a: `0x${string}`) => void }) {
  const { address } = useAccount();
  const client = usePublicClient();
  const [templateId, setTemplateId] = useState<TemplateId>("startup");
  const template = TEMPLATES.find((t) => t.id === templateId)!;
  const [members, setMembers] = useState<MemberRow[]>([{ address: address ?? "", roles: ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR }, { address: "", roles: ROLE_OWNER | ROLE_APPROVER }, { address: "", roles: ROLE_GUARDIAN }]);
  const [salt, setSalt] = useState(`vault-${Date.now()}`);
  const [created, setCreated] = useState<`0x${string}` | null>(null);
  const tx = useTx(async () => {
    if (!client || !address) return;
    const predicted = await client.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "predictVaultAddress", args: [address, keccak256(stringToHex(salt))] });
    setCreated(predicted);
    onCreated(predicted);
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
    const assets = [DEPLOYMENTS.testUsd, NATIVE_ASSET] as const;
    const limits = [template.stable, template.native];
    tx.send({
      address: DEPLOYMENTS.factory,
      abi: SkurFactoryAbi,
      functionName: "createVault",
      args: [keccak256(stringToHex(salt)), members.map((m) => m.address as `0x${string}`), members.map((m) => m.roles), policyToContract(template.policy), assets, limits],
    });
  };

  return (
    <Card title="Create a vault" subtitle="Pick a template, name the signers and guardians, sign once. The vault is a minimal proxy over the verified implementation; the factory keeps no authority over it.">
      <div className="templates" style={{ marginBottom: 20 }}>
        {TEMPLATES.map((t) => (
          <button key={t.id} className={`template ${templateId === t.id ? "active" : ""}`} onClick={() => setTemplateId(t.id)}>
            <strong>{t.name}</strong>
            <span className="caption">{t.tagline}</span>
            <div className="caption" style={{ marginTop: 6 }}>
              critical delay {fmtDuration(t.policy.delayCritical)} · new recipient {fmtDuration(t.policy.recipientActivationDelay)} · envelope {t.policy.envelopeBps / 100}%/day
            </div>
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Owner</th>
            <th>Approver</th>
            <th>Executor</th>
            <th>Guardian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={i}>
              <td style={{ width: "45%" }}>
                <div className="inline" style={{ flexWrap: "nowrap" }}>
                  {isAddress(m.address) ? <Identicon address={m.address} size={28} /> : <span className="token-ico" style={{ width: 28, height: 28 }}>?</span>}
                  <input value={m.address} onChange={(e) => setRow(i, { address: e.target.value.trim() })} placeholder="0x…" style={{ height: 36 }} />
                </div>
              </td>
              {[ROLE_OWNER, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN].map((b) => (
                <td key={b}>
                  <input type="checkbox" checked={Boolean(m.roles & b)} onChange={() => toggleRole(i, b)} />
                </td>
              ))}
              <td>
                <Button kind="ghost" size="sm" onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>Remove</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 16 }}>
        <Button kind="secondary" onClick={() => setMembers((ms) => [...ms, { address: "", roles: ROLE_APPROVER }])}>Add member</Button>
        <Field label="Salt (makes the address predictable)">
          <input value={salt} onChange={(e) => setSalt(e.target.value)} />
        </Field>
      </div>
      <p className="caption">
        {counts.owners} owners · {counts.approvers} approvers · {counts.executors} executors · {counts.guardians} guardians. Template needs {template.minSigners}+ signers and {template.minGuardians}+ guardians. Assets approved at creation: sUSD and KASH.
      </p>
      {errors.length > 0 && (
        <div className="notice notice-bad">
          <div>
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        </div>
      )}
      <div className="inline" style={{ marginTop: 8 }}>
        <Button onClick={create} disabled={!address || errors.length > 0 || tx.busy}>Create vault</Button>
        {created && <Badge tone="ok">Created {short(created)}</Badge>}
      </div>
      <TxStatus state={tx.state} />
    </Card>
  );
}
