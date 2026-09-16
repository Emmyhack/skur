import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { isAddress, stringToHex } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { NATIVE_ASSET } from "@web/config/chain";
import { fmtAmount, fmtDuration, short } from "@web/lib/format";
import { computeMaxLoss } from "@web/lib/maxLoss";
import { postureItems } from "@web/lib/posture";
import { Mode, MODE_LABEL, ROLE_GUARDIAN, ROLE_OWNER } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { Identicon } from "../components/Identicon";
import { BackButton, Badge, Button, Card, Expandable, Field, Input, KV, ModeBadge, Notice, Row, Screen, Tape, TopBar, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

type Panel = "posture" | "mode" | "guardians" | "recovery" | "loss" | "history" | null;

/** One card per concern, each opening on tap, so the screen reads as a short list rather than a wall. */
export function Security({ vault, refetch, refreshing }: { vault: VaultData; refetch: () => void; refreshing: boolean }) {
  const nav = useNavigation<{ goBack: () => void; canGoBack: () => boolean }>();
  const roles = useMyRoles(vault);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [open, setOpen] = useState<Panel>("posture");
  const [reason, setReason] = useState("");
  const [oldSigner, setOldSigner] = useState("");
  const [newSigner, setNewSigner] = useState("");
  const toggle = (p: Panel) => setOpen((o) => (o === p ? null : p));
  const r32 = stringToHex(reason.slice(0, 31), { size: 32 });
  const call = (fn: string, args: readonly unknown[]) => tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: fn, args });
  const guardians = vault.members.filter((m) => m.roles & ROLE_GUARDIAN);
  const posture = postureItems(vault);
  const ok = posture.filter((i) => i.ok === "ok").length;
  const weakest = posture.find((i) => i.ok === "bad") ?? posture.find((i) => i.ok === "warn");
  const stable = vault.assets.find((a) => a.address !== NATIVE_ASSET) ?? vault.assets[0];
  const loss = stable ? computeMaxLoss(vault.policy, stable.limits, stable.balance, vault.mode) : null;
  const canRaise = Boolean(roles & (ROLE_OWNER | ROLE_GUARDIAN));
  const isGuardian = Boolean(roles & ROLE_GUARDIAN);

  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={C.accent} />}
      top={<><TopBar left={nav.canGoBack() ? <BackButton onPress={() => nav.goBack()} /> : undefined} title="Security" right={<ModeBadge mode={vault.mode} />} />{vault.mode !== Mode.NORMAL && <Tape />}</>}>
      <View style={{ padding: 16 }}>
        <Expandable title="Posture" summary={`${ok} of ${posture.length} controls confirmed${weakest ? ` · ${weakest.text}` : ""}`} icon="check-circle" tone={ok === posture.length ? "success" : "warn"} open={open === "posture"} onToggle={() => toggle("posture")}>
          {posture.map((i) => (
            <View key={i.text} style={{ flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" }}>
              <Text style={{ color: i.ok === "ok" ? C.success : i.ok === "warn" ? C.warning : C.error, fontFamily: F.bodyBold, width: 14 }}>{i.ok === "ok" ? "✓" : i.ok === "warn" ? "!" : "✕"}</Text>
              <Text style={{ fontFamily: F.body, color: C.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{i.text}</Text>
            </View>
          ))}
        </Expandable>

        <Expandable title="Security mode" summary={`${MODE_LABEL[vault.mode]} · raise instantly, lower through governance`} icon="shield" tone={vault.mode === Mode.NORMAL ? "dark" : "warn"} open={open === "mode"} onToggle={() => toggle("mode")}>
          <Field label="Reason (recorded onchain, 31 characters)"><Input value={reason} onChangeText={setReason} placeholder="phishing incident" maxLength={31} /></Field>
          <View style={{ gap: 8 }}>
            {vault.mode < Mode.ELEVATED && <Button kind="secondary" icon="alert-triangle" disabled={!canRaise} loading={tx.busy} onPress={() => call("raiseMode", [Mode.ELEVATED, r32])}>Raise to Elevated</Button>}
            {vault.mode < Mode.LOCKDOWN && <Button kind="danger" icon="lock" disabled={!canRaise} onPress={() => call("raiseMode", [Mode.LOCKDOWN, r32])}>Freeze vault</Button>}
            {vault.mode > Mode.NORMAL && <Button icon="unlock" disabled={!(roles & ROLE_OWNER)} loading={tx.busy} onPress={() => call("proposeModeRelax", [vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL])}>Propose lowering to {MODE_LABEL[vault.mode === Mode.LOCKDOWN ? Mode.ELEVATED : Mode.NORMAL]}</Button>}
          </View>
          <Text style={[s.hint, { marginTop: 8 }]}>{canRaise ? "Lowering the mode needs owners and guardians together." : "Only an owner or guardian signer can change the mode."}</Text>
        </Expandable>

        <Expandable title="Guardians" summary={guardians.length ? `${guardians.length} · freeze, veto, confirm, recover` : "none configured"} icon="users" tone={guardians.length ? "dark" : "error"} open={open === "guardians"} onToggle={() => toggle("guardians")}>
          {guardians.length === 0 ? <Notice tone="bad">No guardian configured. Nobody independent can veto a proposal or freeze the vault.</Notice> : guardians.map((g) => (
            <View key={g.address} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}><Identicon address={g.address} size={32} /><Text style={[s.addr, { flex: 1 }]}>{short(g.address, 6)}</Text><Badge tone="accent">Guardian</Badge></View>
          ))}
          <KV k="Veto" v="any single guardian, before execution" />
          <KV k="Critical confirmation" v={vault.policy.guardianRequiredCritical ? `${vault.policy.guardianThreshold} of ${guardians.length}` : "not required"} last />
        </Expandable>

        <Expandable title="Recovery" summary={`replace a lost signer after ${fmtDuration(vault.policy.recoveryDelay)}`} icon="life-buoy" open={open === "recovery"} onToggle={() => toggle("recovery")}>
          <Text style={[s.rowSub, { marginBottom: 12, lineHeight: 20 }]}>The new address takes the same roles. Any owner can cancel during the delay, and the vault moves to Elevated when it completes.</Text>
          <Field label="Signer to replace"><Input value={oldSigner} onChangeText={(t) => setOldSigner(t.trim())} placeholder="0x…" mono /></Field>
          <Field label="New signer"><Input value={newSigner} onChangeText={(t) => setNewSigner(t.trim())} placeholder="0x…" mono /></Field>
          <Button icon="life-buoy" disabled={!isGuardian || !isAddress(oldSigner) || !isAddress(newSigner) || tx.busy} loading={tx.busy} onPress={() => call("proposeRecovery", [oldSigner as `0x${string}`, newSigner as `0x${string}`])}>Propose recovery</Button>
          {!isGuardian && <Text style={[s.hint, { marginTop: 8 }]}>Only a guardian signer can start a recovery.</Text>}
        </Expandable>

        {loss && stable && (
          <Expandable title="Maximum possible loss" summary={`${fmtAmount(loss.immediate, stable.decimals, stable.symbol)} with no delay · ${fmtAmount(loss.day, stable.decimals, stable.symbol)} within 24h`} icon="trending-down" open={open === "loss"} onToggle={() => toggle("loss")}>
            <KV k="With no delay" v={`${fmtAmount(loss.immediate, stable.decimals, stable.symbol)} · ${loss.immediateBinding}`} />
            <KV k="Within 24h" v={`${fmtAmount(loss.day, stable.decimals, stable.symbol)} · ${loss.dayBinding}`} />
            <KV k="Largest transfers wait" v={fmtDuration(loss.criticalDelay)} last />
            <Text style={[s.hint, { marginTop: 8 }]}>A conservative upper bound for {stable.symbol} under the stated assumptions. A bound, never a guarantee.</Text>
          </Expandable>
        )}

        <Expandable title="Mode history" summary={vault.modeHistory.length ? `${vault.modeHistory.length} change${vault.modeHistory.length === 1 ? "" : "s"} recorded` : "never changed"} icon="clock" open={open === "history"} onToggle={() => toggle("history")}>
          {vault.modeHistory.length === 0 ? <Text style={s.hint}>The mode has never changed.</Text> : [...vault.modeHistory].reverse().slice(0, 8).map((h, i, arr) => (
            <KV key={h.txHash + i} k={`${MODE_LABEL[h.previous]} → ${MODE_LABEL[h.mode]}`} v={`${h.reason || "no reason"} · ${short(h.by)}`} last={i === arr.length - 1} />
          ))}
        </Expandable>

        <TxStatus state={tx.state} />
      </View>
    </Screen>
  );
}
