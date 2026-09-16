import { useNavigation, useRoute } from "@react-navigation/native";
import { Linking, Text, View } from "react-native";
import { stringToHex } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { ARK_DEVNET_EXPLORER } from "@web/config/chain";
import { fmtDate, fmtDuration, nowSec, short } from "@web/lib/format";
import { explainReasons, Kind, Mode, ROLE_APPROVER, ROLE_EXECUTOR, ROLE_GUARDIAN, ROLE_OWNER, Status } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { describeProposal, memoText, statusText } from "../lib/describe";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { Address, Badge, Button, Card, KV, Notice, Screen, StatusBadge, TierBadge, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

export function TxDetail({ vault }: { vault: VaultData }) {
  const route = useRoute<{ key: string; name: string; params: { id: string } }>();
  const nav = useNavigation<{ goBack: () => void }>();
  const { signer } = useStore();
  const roles = useMyRoles(vault);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const p = vault.proposals.find((x) => String(x.id) === route.params.id);
  if (!p) return <Screen title="Proposal"><Notice tone="neutral">This proposal is not in the loaded range.</Notice></Screen>;
  const d = describeProposal(p, vault);
  const now = nowSec();
  const pending = p.status === Status.PENDING;
  const expired = pending && Number(p.expiresAt) <= now;
  const timelocked = pending && Number(p.executableAfter) > now;
  const approvalsMet = p.liveApprovals >= p.requiredApprovals && p.liveGuardians >= p.requiredGuardians;
  const me = signer?.address.toLowerCase();
  const alreadyApproved = Boolean(me && (p.approvers.some((a) => a.toLowerCase() === me) || p.guardianConfirmers.some((a) => a.toLowerCase() === me)));
  const canApprove = pending && !expired && !alreadyApproved && Boolean(roles & (p.kind === Kind.TRANSFER ? ROLE_APPROVER | ROLE_GUARDIAN : ROLE_OWNER | ROLE_GUARDIAN)) && (roles & ROLE_GUARDIAN ? p.requiredGuardians > 0 : true);
  const lockedOut = vault.mode === Mode.LOCKDOWN && (p.kind === Kind.TRANSFER || p.securityReducing);
  const canExecute = pending && !expired && approvalsMet && !timelocked && !lockedOut && Boolean(roles & (p.kind === Kind.TRANSFER ? ROLE_EXECUTOR | ROLE_OWNER : ROLE_OWNER));
  const canVeto = pending && p.vetoable && Boolean(roles & ROLE_GUARDIAN);
  const canCancel = pending && Boolean(me && (p.proposer.toLowerCase() === me || roles & ROLE_OWNER));
  const call = (fn: string, args: readonly unknown[] = [p.id]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: fn, args });
  const memo = memoText(p);

  return (
    <Screen title={d.title} sub={d.detail} right={pending ? <Badge tone="warn">{statusText(p)}</Badge> : <StatusBadge status={p.status} />}>
      <Card>
        <KV k="Proposal" v={`#${String(p.id)} · ${p.securityReducing ? "security-reducing" : "not security-reducing"}`} />
        {memo ? <KV k="Purpose" v={memo} /> : null}
        <KV k="Proposed by" v={<Address value={p.proposer} />} />
        <KV k="Created" v={fmtDate(p.createdAt)} />
        {p.kind === Kind.TRANSFER && <KV k="Risk tier" v={<TierBadge tier={p.tier} />} />}
        <KV k="Requirement" v={`${p.requiredApprovals} approval${p.requiredApprovals === 1 ? "" : "s"}${p.requiredGuardians ? ` + ${p.requiredGuardians} guardian` : ""}`} />
        <KV k={timelocked ? "Executable after" : "Delay"} v={timelocked ? fmtDate(p.executableAfter) : Number(p.executableAfter) > Number(p.createdAt) ? fmtDuration(Number(p.executableAfter - p.createdAt)) : "none"} />
        <KV k="Expires" v={fmtDate(p.expiresAt)} />
        <KV k="Guardian veto" v={p.vetoable ? "open until execution" : "not vetoable"} last />
      </Card>
      {p.kind === Kind.TRANSFER && explainReasons(p.riskReasons).length > 0 && (
        <Card title="Why this tier">
          {explainReasons(p.riskReasons).map((t) => <Text key={t} style={{ fontFamily: F.body, color: C.text, fontSize: 14, lineHeight: 22 }}>▪ {t}</Text>)}
        </Card>
      )}
      <Card title="Confirmations">
        <Text style={s.kvK}>Signers ({p.liveApprovals} of {p.requiredApprovals})</Text>
        {p.approvers.length === 0 ? <Text style={[s.hint, { marginBottom: 8 }]}>None yet</Text> : p.approvers.map((a) => <Text key={a} style={[s.addr, { marginVertical: 3 }]}>✓ {short(a, 6)}</Text>)}
        {p.requiredGuardians > 0 && (
          <>
            <Text style={[s.kvK, { marginTop: 8 }]}>Guardians ({p.liveGuardians} of {p.requiredGuardians})</Text>
            {p.guardianConfirmers.length === 0 ? <Text style={s.hint}>Independent sign-off required</Text> : p.guardianConfirmers.map((a) => <Text key={a} style={[s.addr, { marginVertical: 3 }]}>✓ {short(a, 6)}</Text>)}
          </>
        )}
      </Card>
      {pending && (
        <Card title="Actions">
          {!signer && <Notice tone="neutral">Add a signer key under Settings to act on this proposal.</Notice>}
          {signer && roles === 0 && <Notice tone="neutral">{short(signer.address)} is not a member of this vault.</Notice>}
          <View style={{ gap: 8 }}>
            {canApprove && <Button onPress={() => call("approve")} loading={tx.busy}>{roles & ROLE_GUARDIAN ? "Confirm as guardian" : "Confirm"}</Button>}
            {Boolean(roles & (ROLE_EXECUTOR | ROLE_OWNER)) && !(roles & ROLE_GUARDIAN) && <Button kind={canApprove ? "secondary" : "primary"} disabled={!canExecute} loading={tx.busy && !canApprove} onPress={() => call("execute")}>{lockedOut ? "Execute (vault in Lockdown)" : timelocked ? "Execute (still inside its delay)" : !approvalsMet ? "Execute (not enough confirmations)" : "Execute"}</Button>}
            {canVeto && <Button kind="danger" onPress={() => call("veto", [p.id, stringToHex("vetoed", { size: 32 })])} loading={tx.busy}>Veto</Button>}
            {canCancel && !expired && <Button kind="ghost" onPress={() => call("cancel")} disabled={tx.busy}>Cancel proposal</Button>}
            {expired && <Button kind="ghost" onPress={() => call("expire")} disabled={tx.busy}>Mark expired</Button>}
          </View>
          <TxStatus state={tx.state} />
        </Card>
      )}
      <Button kind="ghost" onPress={() => void Linking.openURL(`${ARK_DEVNET_EXPLORER}/address/${vault.address}`)}>View vault on Blockscout</Button>
      <Button kind="ghost" onPress={() => nav.goBack()}>Back</Button>
    </Screen>
  );
}
