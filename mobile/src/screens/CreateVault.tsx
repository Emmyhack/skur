import { useNavigation } from "@react-navigation/native";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type TextInput } from "react-native";
import { isAddress, keccak256, stringToHex } from "viem";
import { SkurFactoryAbi } from "@web/abi/SkurFactory";
import { DEPLOYMENTS, NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, fmtDuration, short } from "@web/lib/format";
import { policyToContract, validateCounts, validatePolicy } from "@web/lib/policy";
import { TEMPLATES, templateById, type TemplateId } from "@web/lib/templates";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER } from "@web/lib/types";
import { publicClient } from "../lib/client";
import { scanBus } from "../lib/scanBus";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { BackButton, Button, Card, CircleIcon, Field, IconButton, Input, KV, Notice, Screen, SectionLabel, SignBar, TopBar, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

type Row = { address: string; roles: number };
const ROLE_CHIPS: Array<[number, string]> = [[ROLE_OWNER, "Owner"], [ROLE_APPROVER, "Approver"], [ROLE_EXECUTOR, "Executor"], [ROLE_GUARDIAN, "Guardian"]];

/** Create a vault from the phone: name, template, members, review, one signature. */
export function CreateVault() {
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string) => void }>();
  const { signer, setVaultAddress, setLabel } = useStore();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("startup");
  const template = templateById(templateId);
  const [members, setMembers] = useState<Row[]>([{ address: signer?.address ?? "", roles: ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR }, { address: "", roles: ROLE_OWNER | ROLE_APPROVER }, { address: "", roles: ROLE_GUARDIAN }]);
  // A three-row address form does not fit above the keyboard, so Return moves to the next member.
  const rowRefs = useRef<Array<TextInput | null>>([]);
  const salt = useMemo(() => keccak256(stringToHex(`vault-${Date.now()}`)), []);
  const counts = members.reduce((a, m) => ({ owners: a.owners + (m.roles & 1 ? 1 : 0), approvers: a.approvers + (m.roles & 2 ? 1 : 0), executors: a.executors + (m.roles & 4 ? 1 : 0), guardians: a.guardians + (m.roles & 8 ? 1 : 0) }), { owners: 0, approvers: 0, executors: 0, guardians: 0 });
  const errors = useMemo(() => {
    const e = [...validatePolicy(template.policy), ...validateCounts(template.policy, counts.owners, counts.approvers, counts.executors, counts.guardians)];
    const addrs = members.map((m) => m.address.toLowerCase());
    if (members.some((m) => !isAddress(m.address))) e.push("Every member needs a valid address.");
    if (new Set(addrs).size !== addrs.length) e.push("Duplicate member address.");
    if (members.some((m) => m.roles === 0)) e.push("Every member needs at least one role.");
    return e;
  }, [template, counts, members]);
  const tx = useTx(async () => {
    if (!signer) return;
    const v = await publicClient.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "predictVaultAddress", args: [signer.address, salt] });
    await setLabel(v, name || "Treasury vault");
    await setVaultAddress(v);
  });
  const setRow = (i: number, patch: Partial<Row>) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggle = (i: number, b: number) => setRow(i, { roles: b === ROLE_GUARDIAN ? (members[i].roles & ROLE_GUARDIAN ? 0 : ROLE_GUARDIAN) : ((members[i].roles & b ? members[i].roles & ~b : members[i].roles | b) & ~ROLE_GUARDIAN) });
  const create = () => void tx.send({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "createVault", args: [salt, members.map((m) => m.address as `0x${string}`), members.map((m) => m.roles), policyToContract(template.policy), [DEPLOYMENTS.testUsd, NATIVE_ASSET], [template.stable, template.native]] });
  return (
    <Screen padded={false}
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Create vault</Text>} />}
      footer={<View><TxStatus state={tx.state} /><View style={{ height: 10 }} /><SignBar label="Create vault" signerAddress={signer?.address} onPress={create} disabled={!signer || errors.length > 0 || tx.busy} loading={tx.busy} hint={!signer ? "Add a signer key first; it pays for the creation" : errors[0]} /></View>}>
      <View style={{ padding: 16 }}>
        <SectionLabel>1 · Name and template</SectionLabel>
        <Card>
          <Field label="Name" hint="Kept on this phone only. The chain knows the vault by its address."><Input value={name} onChangeText={setName} placeholder="Main treasury" maxLength={40} /></Field>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TEMPLATES.map((t) => <Pressable key={t.id} onPress={() => setTemplateId(t.id)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: templateId === t.id ? C.accent : C.card2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: templateId === t.id ? C.onAccent : C.text }}>{t.name}</Text></Pressable>)}
          </View>
          <Text style={[s.hint, { marginTop: 10 }]}>{template.tagline} Needs {template.minSigners}+ signers and {template.minGuardians}+ guardian{template.minGuardians === 1 ? "" : "s"}.</Text>
        </Card>
        <SectionLabel>2 · Signers and guardians</SectionLabel>
        <Text style={[s.hint, { marginBottom: 8 }]}>Owners govern, approvers confirm payments, executors execute. Guardians can only freeze, veto and recover; the contract will not let them hold a treasury role.</Text>
        {members.map((m, i) => (
          <Card key={i}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {isAddress(m.address) ? <Identicon address={m.address} size={32} /> : <CircleIcon name="user" size={32} />}
              <Input ref={(r) => { rowRefs.current[i] = r; }} value={m.address} onChangeText={(t) => setRow(i, { address: t.trim() })} placeholder="0x…" mono style={{ flex: 1 }} returnKeyType={i < members.length - 1 ? "next" : "done"} submitBehavior={i < members.length - 1 ? "submit" : "blurAndSubmit"} onSubmitEditing={() => rowRefs.current[i + 1]?.focus()} />
              <IconButton name="maximize" onPress={() => { scanBus.request((a) => setRow(i, { address: a })); nav.navigate("Scan"); }} />
              <IconButton name="x" onPress={() => setMembers((ms) => ms.filter((_, j) => j !== i))} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {ROLE_CHIPS.map(([b, label]) => <Pressable key={b} onPress={() => toggle(i, b)} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: m.roles & b ? (b === ROLE_GUARDIAN ? C.accent : C.accentBg) : C.card2, borderWidth: 1, borderColor: m.roles & b ? C.accent : "transparent", alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: m.roles & b && b === ROLE_GUARDIAN ? C.onAccent : C.text }}>{label}</Text></Pressable>)}
            </View>
          </Card>
        ))}
        <Button kind="secondary" size="sm" icon="plus" onPress={() => setMembers((ms) => [...ms, { address: "", roles: ROLE_APPROVER }])}>Add member</Button>
        <SectionLabel>3 · Review</SectionLabel>
        <Card>
          <KV k="Members" v={`${members.length} (${counts.guardians} guardian${counts.guardians === 1 ? "" : "s"})`} />
          <KV k="Approvals by tier" v={`Low ${template.policy.approvalsLow} · High ${template.policy.approvalsHigh} · Critical ${template.policy.approvalsCritical}${template.policy.guardianRequiredCritical ? ` + ${template.policy.guardianThreshold} guardian` : ""}`} />
          <KV k="Delays" v={`High ${fmtDuration(template.policy.delayHigh)} · Critical ${fmtDuration(template.policy.delayCritical)} · New recipient ${fmtDuration(template.policy.recipientActivationDelay)}`} />
          <KV k="Loss envelope" v={template.policy.envelopeBps ? `${template.policy.envelopeBps / 100}% per ${fmtDuration(template.policy.envelopeWindow)}, then Lockdown` : "off"} />
          <KV k="sUSD limits" v={`routine ≤ ${fmtAmount(template.stable.lowMax, 6)} · per tx ≤ ${template.stable.perTxMax ? fmtAmount(template.stable.perTxMax, 6) : "∞"} · daily ≤ ${template.stable.dailyMax ? fmtAmount(template.stable.dailyMax, 6) : "∞"}`} />
          <KV k="Network" v="Ark Constellation devnet · 9000" />
          <KV k="Creator" v={signer ? short(signer.address) : "no signer"} last />
        </Card>
        {errors.length > 0 && <Notice tone="warn">{errors.join(" ")}</Notice>}
        <Text style={[s.hint, { marginTop: 8 }]}>The vault is a minimal proxy over the verified implementation. The factory that creates it keeps no authority over it; only the members listed above can act.</Text>
      </View>
    </Screen>
  );
}
