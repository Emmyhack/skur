import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { fmtDuration, short } from "@web/lib/format";
import { ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, roleNames } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { scanBus } from "../lib/scanBus";
import { Address, BackButton, Badge, Button, Card, Field, IconButton, Input, Notice, Row, Screen, SectionLabel, Sheet, TopBar, TxStatus, s } from "../components/ui";
import { Identicon } from "../components/Identicon";
import { C, F } from "../theme";

const ROLE_BITS: Array<[number, string, string]> = [[ROLE_OWNER, "Owner", "governs"], [ROLE_APPROVER, "Approver", "confirms payments"], [ROLE_EXECUTOR, "Executor", "executes"], [ROLE_GUARDIAN, "Guardian", "freeze · veto · recover"]];

export function Members({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string) => void }>();
  const { signer } = useStore();
  const roles = useMyRoles(vault);
  const isOwner = Boolean(roles & ROLE_OWNER);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [bits, setBits] = useState(ROLE_APPROVER);
  const existing = vault.members.find((m) => m.address.toLowerCase() === target.toLowerCase());
  const adds = existing ? bits & ~existing.roles : bits;
  const reducing = adds !== 0 || Boolean(existing && existing.roles & ROLE_GUARDIAN && !(bits & ROLE_GUARDIAN));
  const toggle = (b: number) => setBits((x) => (b === ROLE_GUARDIAN ? (x & ROLE_GUARDIAN ? 0 : ROLE_GUARDIAN) : ((x & b ? x & ~b : x | b) & ~ROLE_GUARDIAN)));
  const edit = (address: string, r: number) => { setTarget(address); setBits(r); setOpen(true); };
  const signers = vault.members.filter((m) => !(m.roles & ROLE_GUARDIAN));
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);
  const List = ({ items }: { items: typeof vault.members }) => (
    <Card flush>
      {items.map((m, i) => (
        <Row key={m.address} leading={<Identicon address={m.address} size={40} />} title={m.address.toLowerCase() === signer?.address.toLowerCase() ? "This phone" : short(m.address, 6)} subtitle={<Address value={m.address} />} chevron={isOwner} onPress={isOwner ? () => edit(m.address, m.roles) : undefined} last={i === items.length - 1}
          trailing={<View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 150 }}>{roleNames(m.roles).map((r) => <Badge key={r} tone={r === "Guardian" ? "accent" : "neutral"}>{r}</Badge>)}</View>} />
      ))}
    </Card>
  );
  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Members</Text>} right={isOwner ? <IconButton name="plus" tone="accent" onPress={() => { setTarget(""); setBits(ROLE_APPROVER); setOpen(true); }} /> : undefined} />}>
      <View style={{ padding: 16 }}>
        <SectionLabel>Treasury signers · {signers.length}</SectionLabel>
        <Text style={[s.hint, { marginBottom: 8 }]}>Owners govern, approvers confirm payments, executors execute once every condition holds. A member may hold several of these roles.</Text>
        <List items={signers} />
        <SectionLabel>Guardians · {guardians.length}</SectionLabel>
        <Text style={[s.hint, { marginBottom: 8 }]}>Guardians can freeze the vault, veto risky or security-reducing proposals, confirm critical transfers and start a recovery. The contract will not let them hold a treasury role.</Text>
        {guardians.length ? <List items={guardians} /> : <Notice tone="bad">No guardian configured. Nobody independent can veto a proposal or freeze the vault.</Notice>}
        <SectionLabel>Thresholds</SectionLabel>
        <Card>
          <Text style={s.rowSub}>Routine {vault.policy.approvalsLow} · High {vault.policy.approvalsHigh} · Critical {vault.policy.approvalsCritical}{vault.policy.guardianRequiredCritical ? ` + ${vault.policy.guardianThreshold} guardian` : ""} · Governance {vault.policy.governanceThreshold} owner{vault.policy.governanceThreshold === 1 ? "" : "s"}</Text>
          <Text style={[s.hint, { marginTop: 6 }]}>Thresholds are part of the policy. Lowering any of them waits {fmtDuration(vault.policy.policyChangeDelay)}, and any guardian can veto the change.</Text>
        </Card>
        <TxStatus state={tx.state} />
      </View>
      <Sheet open={open} onClose={() => setOpen(false)} title={existing ? (bits === 0 ? "Remove member" : "Change roles") : "Add member"}>
        <Field label="Member address"><View style={{ flexDirection: "row", gap: 8 }}><Input value={target} onChangeText={(t) => setTarget(t.trim())} placeholder="0x…" mono style={{ flex: 1 }} editable={!existing} /><IconButton name="maximize" onPress={() => { scanBus.request((a) => setTarget(a)); nav.navigate("Scan"); }} /></View></Field>
        <Field label="Roles" hint="A guardian holds no treasury role; selecting it clears the others.">
          <View style={{ gap: 8 }}>
            {ROLE_BITS.map(([b, name, desc]) => (
              <Pressable key={b} onPress={() => toggle(b)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: bits & b ? C.accentBg : C.card2, borderWidth: 1, borderColor: bits & b ? C.accent : "transparent" }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: bits & b ? C.accent : C.border }} />
                <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bodyBold, color: C.text }}>{name}</Text><Text style={s.rowSub}>{desc}</Text></View>
              </Pressable>
            ))}
          </View>
        </Field>
        <Text style={[s.hint, { marginBottom: 12 }]}>{bits === 0 ? "Removing a member takes effect as soon as owners approve." : reducing ? `Adding authority or weakening the guardian layer loosens security: it waits ${fmtDuration(vault.policy.policyChangeDelay)} and any guardian can veto it.` : "Reducing a member's authority takes effect as soon as owners approve."}</Text>
        <Button disabled={!isAddress(target) || tx.busy || (existing?.roles === bits)} loading={tx.busy} onPress={() => { void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeMember", args: [target as `0x${string}`, bits] }); setOpen(false); }}>{existing ? (bits === 0 ? "Propose removal" : "Propose new roles") : "Propose member"}</Button>
        {existing && bits !== 0 && <Button kind="ghost" style={{ marginTop: 6 }} onPress={() => setBits(0)}>Remove this member instead</Button>}
      </Sheet>
    </Screen>
  );
}
