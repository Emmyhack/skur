import { useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { stringToHex } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, fmtDuration, short } from "@web/lib/format";
import { computeMaxLoss } from "@web/lib/maxLoss";
import { postureItems } from "@web/lib/posture";
import { Mode, MODE_LABEL, ROLE_GUARDIAN, ROLE_OWNER } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { Badge, Button, Card, Field, Input, KV, ModeBadge, Notice, Screen, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

export function Security({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const roles = useMyRoles(vault);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [reason, setReason] = useState("");
  const r32 = stringToHex(reason.slice(0, 31), { size: 32 });
  const call = (fn: string, args: readonly unknown[]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: fn, args });
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);
  const posture = postureItems(vault);
  const okCount = posture.filter((i) => i.ok === "ok").length;
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const loss = stable ? computeMaxLoss(vault.policy, stable.limits, stable.balance, vault.mode) : null;
  const canRaise = Boolean(roles & (ROLE_OWNER | ROLE_GUARDIAN));

  return (
    <Screen title="Security" right={<ModeBadge mode={vault.mode} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}>
      <Card title="Posture" action={<Badge tone={okCount === posture.length ? "ok" : "warn"}>{okCount} of {posture.length} confirmed</Badge>}>
        {posture.map((i) => (
          <View key={i.text} style={{ flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" }}>
            <Text style={{ color: i.ok === "ok" ? C.success : i.ok === "warn" ? C.warning : C.error, fontFamily: F.bodyBold }}>{i.ok === "ok" ? "✓" : i.ok === "warn" ? "!" : "✕"}</Text>
            <Text style={{ fontFamily: F.body, color: C.text, fontSize: 14, flex: 1 }}>{i.text}</Text>
          </View>
        ))}
      </Card>

      <Card title="Security mode">
        <Text style={[s.sub, { marginBottom: 12 }]}>Any owner or guardian can raise the mode at once. Lowering it needs owners and guardians together, and leaving Lockdown also waits out the policy-change delay.</Text>
        <Field label="Reason (recorded onchain, 31 characters)"><Input value={reason} onChangeText={setReason} placeholder="phishing incident" maxLength={31} /></Field>
        <View style={{ gap: 8 }}>
          {vault.mode < Mode.ELEVATED && <Button kind="secondary" disabled={!canRaise} loading={tx.busy} onPress={() => call("raiseMode", [Mode.ELEVATED, r32])}>Raise to Elevated</Button>}
          {vault.mode < Mode.LOCKDOWN && <Button kind="danger" disabled={!canRaise} onPress={() => call("raiseMode", [Mode.LOCKDOWN, r32])}>Freeze vault</Button>}
          {vault.mode > Mode.NORMAL && <Button disabled={!(roles & ROLE_OWNER)} loading={tx.busy} onPress={() => call("proposeModeRelax", [vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL])}>Propose lowering to {MODE_LABEL[vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL]}</Button>}
        </View>
        {!canRaise && <Text style={[s.hint, { marginTop: 8 }]}>Only an owner or guardian signer can change the mode.</Text>}
        <TxStatus state={tx.state} />
      </Card>

      <Card title="Guardians">
        {guardians.length === 0 ? <Notice tone="bad">No guardian configured. Nobody independent can veto a proposal or freeze the vault.</Notice> : guardians.map((g) => <KV key={g.address} k={short(g.address, 6)} v={<Badge tone="accent">Guardian</Badge>} />)}
        <KV k="Veto" v="any single guardian, any time before execution" />
        <KV k="Critical confirmation" v={vault.policy.guardianRequiredCritical ? `${vault.policy.guardianThreshold} of ${guardians.length}` : "not required"} />
        <KV k="Recovery" v={`after ${fmtDuration(vault.policy.recoveryDelay)}, any owner can cancel`} last />
      </Card>

      {loss && stable && (
        <Card title="Maximum possible loss">
          <KV k="Could leave with no delay" v={`${fmtAmount(loss.immediate, stable.decimals, stable.symbol)} · ${loss.immediateBinding}`} />
          <KV k="Could leave within 24h" v={`${fmtAmount(loss.day, stable.decimals, stable.symbol)} · ${loss.dayBinding}`} />
          <KV k="Largest transfers wait" v={fmtDuration(loss.criticalDelay)} last />
          <Text style={[s.hint, { marginTop: 8 }]}>A conservative upper bound for {stable.symbol} under the stated assumptions. A bound, never a guarantee.</Text>
        </Card>
      )}

      <Card title="Mode history">
        {vault.modeHistory.length === 0 ? <Text style={s.hint}>The mode has never changed.</Text> : [...vault.modeHistory].reverse().slice(0, 8).map((h, i) => (
          <KV key={h.txHash + i} k={`${MODE_LABEL[h.previous]} → ${MODE_LABEL[h.mode]}`} v={`${h.reason || "no reason"} · ${short(h.by)}`} />
        ))}
      </Card>
    </Screen>
  );
}
