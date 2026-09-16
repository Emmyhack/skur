import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { fmtAmount, fmtDuration, parseAmount } from "@web/lib/format";
import { limitReductions, policyReductions, policyToContract, validateLimits, validatePolicy } from "@web/lib/policy";
import { H, POLICY_GROUPS, type PolicyField } from "@web/lib/policyFields";
import { TEMPLATES, type TemplateId } from "@web/lib/templates";
import { ROLE_OWNER, type AssetLimits, type Policy } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { useInvalidateVault, useMyRoles } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { BackButton, Badge, Button, Card, Field, IconButton, Input, Notice, Screen, SectionLabel, SignBar, Tabs, TopBar, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

/** The policy editor: templates, every control in groups, security-reducing detection, and per-asset limits. */
export function Policy({ vault }: { vault: VaultData }) {
  const nav = useNavigation<{ goBack: () => void }>();
  const { signer } = useStore();
  const roles = useMyRoles(vault);
  const isOwner = Boolean(roles & ROLE_OWNER);
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(invalidate);
  const [tab, setTab] = useState<"policy" | "limits">("policy");
  const [draft, setDraft] = useState<Policy>(vault.policy);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const seen = useRef(vault.policyVersion);
  if (seen.current !== vault.policyVersion) { seen.current = vault.policyVersion; if (JSON.stringify(draft) !== JSON.stringify(vault.policy)) setDraft(vault.policy); }
  const changed = JSON.stringify(draft) !== JSON.stringify(vault.policy);
  const errors = validatePolicy(draft);
  const reductions = policyReductions(vault.policy, draft);
  const set = (k: keyof Policy, v: number | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  // asset limits
  const [assetAddr, setAssetAddr] = useState(vault.assets[0]?.address);
  const asset = vault.assets.find((a) => a.address === assetAddr) ?? vault.assets[0];
  const toText = (l: AssetLimits, d: number) => ({ approved: l.approved, lowMax: fmtAmount(l.lowMax, d, undefined, 6).replace(/,/g, ""), highMax: fmtAmount(l.highMax, d, undefined, 6).replace(/,/g, ""), perTxMax: fmtAmount(l.perTxMax, d, undefined, 6).replace(/,/g, ""), dailyMax: fmtAmount(l.dailyMax, d, undefined, 6).replace(/,/g, "") });
  const [text, setText] = useState(asset ? toText(asset.limits, asset.decimals) : null);
  const [textFor, setTextFor] = useState(assetAddr);
  if (asset && textFor !== asset.address) { setTextFor(asset.address); setText(toText(asset.limits, asset.decimals)); }
  const parsed: AssetLimits | null = asset && text ? (() => { const p = (t: string) => parseAmount(t || "0", asset.decimals); const a = [p(text.lowMax), p(text.highMax), p(text.perTxMax), p(text.dailyMax)]; return a.every((x) => x !== null) ? { approved: text.approved, lowMax: a[0]!, highMax: a[1]!, perTxMax: a[2]!, dailyMax: a[3]! } : null; })() : null;
  const limitErrors = parsed ? validateLimits(parsed) : ["Enter valid amounts."];
  const limitReds = asset && parsed ? limitReductions(asset.limits, parsed) : [];
  const limitsChanged = asset && parsed ? JSON.stringify(parsed, (_, v) => (typeof v === "bigint" ? v.toString() : v)) !== JSON.stringify(asset.limits, (_, v) => (typeof v === "bigint" ? v.toString() : v)) : false;

  const proposePolicy = () => void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposePolicy", args: [policyToContract(draft)] });
  const proposeLimits = () => parsed && asset && void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeAssetLimits", args: [asset.address, parsed] });

  return (
    <Screen padded={false}
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Policy</Text>} right={<Badge tone="neutral">v{vault.policyVersion}</Badge>} />}
      footer={
        <View>
          <TxStatus state={tx.state} />
          <View style={{ height: 10 }} />
          {tab === "policy"
            ? <SignBar label={reductions.length ? "Propose (security-reducing)" : "Propose policy"} signerAddress={signer?.address} onPress={proposePolicy} disabled={!isOwner || !changed || errors.length > 0 || tx.busy} loading={tx.busy} hint={!isOwner ? "Only an owner signer can propose a policy" : !changed ? "Nothing has changed yet" : errors.length ? errors[0] : reductions.length ? `Waits ${fmtDuration(vault.policy.policyChangeDelay)} and any guardian can veto` : "Applies as soon as owners approve"} />
            : <SignBar label="Propose limits" signerAddress={signer?.address} onPress={proposeLimits} disabled={!isOwner || !limitsChanged || limitErrors.length > 0 || tx.busy} loading={tx.busy} hint={!isOwner ? "Only an owner signer can propose limits" : !limitsChanged ? "Nothing has changed yet" : limitErrors.length ? limitErrors[0] : limitReds.length ? `Security-reducing: ${limitReds.join("; ")}` : "Applies as soon as owners approve"} />}
        </View>
      }>
      <View style={{ paddingHorizontal: 16 }}>
        <Tabs value={tab} options={[["policy", "Policy"], ["limits", "Asset limits"]]} onChange={setTab} />
      </View>
      {tab === "policy" && (
        <View style={{ padding: 16 }}>
          <SectionLabel>Templates</SectionLabel>
          <Text style={[s.hint, { marginBottom: 10 }]}>Start from a profile instead of designing a policy from scratch. Choosing one only fills the editor; nothing is proposed until you sign.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {TEMPLATES.map((t) => (
              <Pressable key={t.id} onPress={() => { setTemplate(t.id); setDraft(t.policy); }} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: template === t.id ? C.accent : C.card2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: template === t.id ? C.onAccent : C.text }}>{t.name}</Text></Pressable>
            ))}
            {changed && <Pressable onPress={() => { setDraft(vault.policy); setTemplate(null); }} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.text2 }}>Reset</Text></Pressable>}
          </View>
          {POLICY_GROUPS.map((g) => (
            <View key={g.title}>
              <SectionLabel>{g.title}</SectionLabel>
              <Text style={[s.hint, { marginBottom: 8 }]}>{g.sub}</Text>
              <Card flush>
                {g.fields.map((f, i) => <Control key={f.key} f={f} value={draft[f.key] as number | boolean} live={vault.policy[f.key] as number | boolean} onChange={(v) => set(f.key, v)} last={i === g.fields.length - 1} />)}
              </Card>
            </View>
          ))}
          {errors.length > 0 && <Notice tone="bad">{errors.join(" ")}</Notice>}
          {changed && errors.length === 0 && <Notice tone={reductions.length ? "warn" : "ok"}>{reductions.length ? `Security-reducing: ${reductions.join("; ")}. Delayed ${fmtDuration(vault.policy.policyChangeDelay)} and any guardian can veto.` : "Tightens or keeps every control. Applies as soon as owners approve."}</Notice>}
          <SectionLabel>History</SectionLabel>
          <Card>
            {vault.policyHistory.length === 0 ? <Text style={s.hint}>No policy versions recorded yet.</Text> : [...vault.policyHistory].reverse().map((h, i, arr) => <Text key={h.txHash} style={[s.rowSub, i < arr.length - 1 && { marginBottom: 6 }]}>v{h.version} · activated {new Date(Number(h.activatedAt) * 1000).toLocaleString()}</Text>)}
          </Card>
        </View>
      )}
      {tab === "limits" && asset && text && (
        <View style={{ padding: 16 }}>
          <Text style={[s.hint, { marginBottom: 10 }]}>Tiers and caps for each asset, in that asset's own units. Approving a new asset loosens security and goes through the delayed path.</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {vault.assets.map((a) => <Pressable key={a.address} onPress={() => setAssetAddr(a.address)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: a.address === assetAddr ? C.accent : C.card2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: a.address === assetAddr ? C.onAccent : C.text }}>{a.symbol}</Text></Pressable>)}
          </View>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><View style={{ flex: 1 }}><Text style={s.rowTitle}>Approved</Text><Text style={s.rowSub}>Unapproved assets cannot be paid out.</Text></View><Switch value={text.approved} onValueChange={(v) => setText({ ...text, approved: v })} trackColor={{ true: C.accent }} /></View>
            {([["lowMax", "Routine up to", "At or below this amount a payment is Low tier."], ["highMax", "High up to", "Above this a payment is Critical."], ["perTxMax", "Per-transaction cap", "0 = no cap."], ["dailyMax", "Daily cap", "Cumulative per 24h bucket. 0 = no cap."]] as Array<[keyof typeof text, string, string]>).map(([k, label, hint]) => (
              <Field key={k} label={`${label} (${asset.symbol})`} hint={hint}><Input value={String(text[k])} onChangeText={(v) => setText({ ...text, [k]: v })} keyboardType="decimal-pad" /></Field>
            ))}
          </Card>
          {limitErrors.length > 0 && limitsChanged && <Notice tone="bad">{limitErrors.join(" ")}</Notice>}
          <Text style={s.hint}>Current: routine ≤ {fmtAmount(asset.limits.lowMax, asset.decimals)} · high ≤ {fmtAmount(asset.limits.highMax, asset.decimals)} · per tx ≤ {asset.limits.perTxMax ? fmtAmount(asset.limits.perTxMax, asset.decimals) : "∞"} · daily ≤ {asset.limits.dailyMax ? fmtAmount(asset.limits.dailyMax, asset.decimals) : "∞"}</Text>
        </View>
      )}
    </Screen>
  );
}

function Control({ f, value, live, onChange, last }: { f: PolicyField; value: number | boolean; live: number | boolean; onChange: (v: number | boolean) => void; last: boolean }) {
  const changed = value !== live;
  const label = <View style={{ flex: 1 }}><Text style={[s.rowTitle, changed && { color: C.accent }]}>{f.label}</Text>{f.hint ? <Text style={s.rowSub}>{f.hint}</Text> : null}</View>;
  const wrap = (control: React.ReactNode) => <View style={[s.row, last && { borderBottomWidth: 0 }]}>{label}{control}</View>;
  if (f.unit === "bool") return wrap(<Switch value={Boolean(value)} onValueChange={(v) => onChange(v)} trackColor={{ true: C.accent }} />);
  const n = Number(value);
  if (f.unit === "count") return wrap(<Stepper value={n} onChange={(v) => onChange(Math.max(0, v))} />);
  if (f.unit === "hours") return wrap(<Unit value={String(Math.round((n / H) * 100) / 100)} unit="h" onChange={(t) => onChange(Math.round(Number(t || 0) * H))} />);
  return wrap(<Unit value={String(n / 100)} unit="%" onChange={(t) => onChange(Math.min((f.max ?? 100) * 100, Math.round(Number(t || 0) * 100)))} />);
}
function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const B = ({ t, onPress }: { t: string; onPress: () => void }) => <Pressable accessibilityRole="button" accessibilityLabel={t === "−" ? "decrease" : "increase"} onPress={onPress} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bodyBold, color: C.text, fontSize: 18 }}>{t}</Text></Pressable>;
  return <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card2, borderRadius: 10 }}><B t="−" onPress={() => onChange(value - 1)} /><Text style={{ fontFamily: F.display, color: C.text, minWidth: 28, textAlign: "center" }}>{value}</Text><B t="+" onPress={() => onChange(value + 1)} /></View>;
}
function Unit({ value, unit, onChange }: { value: string; unit: string; onChange: (t: string) => void }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Input value={value} onChangeText={onChange} keyboardType="decimal-pad" style={{ width: 80, height: 38, textAlign: "right" }} /><Text style={{ fontFamily: F.mono, color: C.text2, width: 18 }}>{unit}</Text></View>;
}
