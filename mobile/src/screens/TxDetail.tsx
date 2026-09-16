import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../state/theme";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { stringToHex } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { ARK_DEVNET_EXPLORER } from "@web/config/chain";
import { fmtAmount, fmtDate, fmtDuration, nowSec, short } from "@web/lib/format";
import { explainReasons, Kind, Mode, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { describeProposal, memoText, statusText } from "../lib/describe";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { Identicon } from "../components/Identicon";
import { Address, BackButton, Badge, Button, Card, CircleIcon, Icon, IconButton, KV, Notice, Row, Screen, SignBar, StatusBadge, TierBadge, TopBar, TxStatus, useStyles } from "../components/ui";
import { KIND_ICON } from "./Transactions";
import { F } from "../theme";

/** Safe's "Confirm transaction": hero amount, To card with advanced details, checks and confirmations rows, sticky sign bar. */
export function TxDetail({ vault }: { vault: VaultData }) {
  const C = useTheme(); const s = useStyles();
  const route = useRoute<{ key: string; name: string; params: { id: string } }>();
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string, p?: object) => void }>();
  const { signer } = useStore();
  const roles = useMyRoles(vault);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [advanced, setAdvanced] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const p = vault.proposals.find((x) => String(x.id) === route.params.id);
  if (!p) return <Screen top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} />}><Notice tone="neutral">This proposal is not in the loaded range.</Notice></Screen>;
  const d = describeProposal(p, vault);
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  const now = nowSec();
  const pending = p.status === Status.PENDING;
  const expired = pending && Number(p.expiresAt) <= now;
  const timelocked = pending && Number(p.executableAfter) > now;
  const approvalsMet = p.liveApprovals >= p.requiredApprovals && p.liveGuardians >= p.requiredGuardians;
  const me = signer?.address.toLowerCase();
  const alreadyApproved = Boolean(me && (p.approvers.some((a) => a.toLowerCase() === me) || p.guardianConfirmers.some((a) => a.toLowerCase() === me)));
  const isGuardian = Boolean(roles & ROLE_GUARDIAN);
  const canApprove = pending && !expired && !alreadyApproved && Boolean(roles & (p.kind === Kind.TRANSFER ? ROLE_APPROVER | ROLE_GUARDIAN : ROLE_OWNER | ROLE_GUARDIAN)) && (isGuardian ? p.requiredGuardians > 0 : true);
  const lockedOut = vault.mode === Mode.LOCKDOWN && (p.kind === Kind.TRANSFER || p.securityReducing);
  const canExecute = pending && !expired && approvalsMet && !timelocked && !lockedOut && Boolean(roles & (p.kind === Kind.TRANSFER ? ROLE_EXECUTOR | ROLE_OWNER : ROLE_OWNER));
  const canVeto = pending && p.vetoable && isGuardian;
  const canCancel = pending && Boolean(me && (p.proposer.toLowerCase() === me || roles & ROLE_OWNER));
  const call = (fn: string, args: readonly unknown[] = [p.id]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: fn, args });
  const memo = memoText(p);
  const reasons = p.kind === Kind.TRANSFER ? explainReasons(p.riskReasons) : [];

  const primary = !signer ? { label: "Add a signer to sign", onPress: () => nav.navigate("Main", { screen: "Settings" }), disabled: false, hint: undefined as string | undefined }
    : roles === 0 ? { label: "Not a member of this vault", onPress: undefined, disabled: true, hint: `${short(signer.address)} holds no role here` }
    : canApprove ? { label: isGuardian ? "Confirm as guardian" : "Confirm", onPress: () => call("approve"), disabled: false, hint: undefined }
    : canExecute ? { label: "Execute", onPress: () => call("execute"), disabled: false, hint: undefined }
    : pending && Boolean(roles & (ROLE_EXECUTOR | ROLE_OWNER)) ? { label: "Execute", onPress: undefined, disabled: true, hint: lockedOut ? "The vault is in Lockdown" : timelocked ? `Executable after ${fmtDate(p.executableAfter)}` : !approvalsMet ? "Waiting for more confirmations" : expired ? "This proposal has expired" : undefined }
    : null;

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>{pending ? "Confirm transaction" : "Transaction"}</Text>} right={<IconButton name="external-link" onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vault.address}`)} />} />}
      footer={pending && primary ? (
        <View>
          <TxStatus state={tx.state} />
          <View style={{ height: 10 }} />
          <SignBar label={primary.label} signerAddress={signer?.address} onPress={primary.onPress} disabled={primary.disabled || tx.busy} loading={tx.busy} hint={primary.hint} />
        </View>
      ) : undefined}>
      <View style={{ alignItems: "center", marginTop: 6, marginBottom: 18 }}>
        <View>
          <CircleIcon name={KIND_ICON[p.kind] ?? "file-text"} size={64} tone={p.status === Status.VETOED ? "error" : p.status === Status.EXECUTED ? "success" : "dark"} text={p.kind === Kind.TRANSFER && asset ? asset.symbol.slice(0, 1) : undefined} />
          {p.kind === Kind.TRANSFER && <View style={{ position: "absolute", right: -4, top: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: C.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.canvas }}><Icon name="arrow-up-right" size={13} color="#fff" /></View>}
        </View>
        <Text style={{ fontFamily: F.display, fontSize: 30, color: C.text, marginTop: 12, letterSpacing: -0.6 }}>{p.kind === Kind.TRANSFER && asset ? `-${fmtAmount(p.amount, asset.decimals, asset.symbol)}` : d.title}</Text>
        <Text style={s.rowSub}>{p.kind === Kind.TRANSFER ? d.title : d.detail} · {fmtDate(p.createdAt)}</Text>
        <View style={{ marginTop: 10 }}>{pending ? <Badge tone="warn" icon="users">{statusText(p)}</Badge> : <StatusBadge status={p.status} />}</View>
      </View>

      <Card>
        {p.kind === Kind.TRANSFER && <KV k="To" v={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Identicon address={p.target} size={22} /><Address value={p.target} /></View>} />}
        {memo ? <KV k="Purpose" v={memo} /> : null}
        <KV k="Network" v="Ark devnet · 9000" />
        <KV k="Proposal" v={`#${String(p.id)}${p.securityReducing ? " · security-reducing" : ""}`} last={!advanced} />
        {advanced && (
          <>
            <KV k="Proposed by" v={<Address value={p.proposer} />} />
            <KV k="Requirement" v={`${p.requiredApprovals} approval${p.requiredApprovals === 1 ? "" : "s"}${p.requiredGuardians ? ` + ${p.requiredGuardians} guardian` : ""}`} />
            <KV k={timelocked ? "Executable after" : "Delay"} v={timelocked ? fmtDate(p.executableAfter) : Number(p.executableAfter) > Number(p.createdAt) ? fmtDuration(Number(p.executableAfter - p.createdAt)) : "none"} />
            <KV k="Expires" v={fmtDate(p.expiresAt)} />
            <KV k="Guardian veto" v={p.vetoable ? "open until execution" : "not vetoable"} />
            <KV k="Policy version" v={`v${p.policyVersion}`} last />
          </>
        )}
        <Button kind="secondary" size="sm" style={{ marginTop: 12 }} onPress={() => setAdvanced((a) => !a)}>{advanced ? "Hide details" : "Advanced details"}</Button>
      </Card>

      {p.kind === Kind.TRANSFER && (
        <Card flush>
          <Row leading={<CircleIcon name="shield" size={36} />} title="Risk review" trailing={<TierBadge tier={p.tier} />} chevron onPress={() => setShowChecks((v) => !v)} last={!showChecks} />
          {showChecks && <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>{reasons.length === 0 ? <Text style={s.rowSub}>No elevated risk signal. Routine tier.</Text> : reasons.map((t) => <Text key={t} style={{ fontFamily: F.body, color: C.text, fontSize: 14, lineHeight: 22 }}>▪ {t}</Text>)}</View>}
        </Card>
      )}
      <Card flush>
        <Row leading={<CircleIcon name="users" size={36} />} title="Confirmations" trailing={<Badge tone={approvalsMet ? "ok" : "warn"}>{p.liveApprovals}/{p.requiredApprovals}{p.requiredGuardians ? ` · ${p.liveGuardians}/${p.requiredGuardians} guardian` : ""}</Badge>} chevron onPress={() => setShowConf((v) => !v)} last={!showConf} />
        {showConf && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
            {p.approvers.length === 0 && p.guardianConfirmers.length === 0 ? <Text style={s.rowSub}>None yet</Text> : null}
            {p.approvers.map((a) => <View key={a} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Identicon address={a} size={22} /><Text style={s.addr}>{short(a, 6)}</Text><Badge tone="ok" icon="check">signer</Badge></View>)}
            {p.guardianConfirmers.map((a) => <View key={a} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Identicon address={a} size={22} /><Text style={s.addr}>{short(a, 6)}</Text><Badge tone="accent" icon="check">guardian</Badge></View>)}
          </View>
        )}
      </Card>

      {pending && (canVeto || canCancel || expired) && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {canVeto && <Button kind="danger" style={{ flex: 1 }} icon="x-octagon" disabled={tx.busy} onPress={() => call("veto", [p.id, stringToHex("vetoed", { size: 32 })])}>Veto</Button>}
          {canCancel && !expired && <Button kind="secondary" style={{ flex: 1 }} disabled={tx.busy} onPress={() => call("cancel")}>Cancel proposal</Button>}
          {expired && <Button kind="secondary" style={{ flex: 1 }} disabled={tx.busy} onPress={() => call("expire")}>Mark expired</Button>}
        </View>
      )}
      {!pending && <TxStatus state={tx.state} />}
      <Pressable onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vault.address}`)} style={{ alignItems: "center", marginTop: 14 }}><Text style={[s.rowSub, { textDecorationLine: "underline" }]}>View vault on Blockscout</Text></Pressable>
    </Screen>
  );
}
