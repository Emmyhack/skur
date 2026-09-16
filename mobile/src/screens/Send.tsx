import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../state/theme";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { scanBus } from "../lib/scanBus";
import { Identicon } from "../components/Identicon";
import { TokenMark } from "../components/TokenMark";
import { isAddress } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { fmtAmount, fmtBps, fmtDuration, parseAmount, short } from "@web/lib/format";
import { describeError } from "@web/lib/errors";
import { explainReasons, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { publicClient } from "../lib/client";
import { useInvalidateVault } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { useStore } from "../state/store";
import { BackButton, Badge, Button, Card, CircleIcon, Field, IconButton, Input, KV, Notice, Row, Screen, Sheet, SignBar, TierBadge, TopBar, TrustBadge, TxStatus, useStyles } from "../components/ui";
import { F } from "../theme";

type Preview = { tier: Tier; reasons: number; exposureBps: number; requiredApprovals: number; requiredGuardians: number; delay: number; trust: Trust };

/** Send: big amount, asset chips, recipient and purpose; the vault's own review card; sticky sign bar to propose. */
export function Send({ vault }: { vault: VaultData }) {
  const C = useTheme(); const s = useStyles();
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string, p?: object) => void }>();
  const route = useRoute<{ key: string; name: string; params?: { asset?: `0x${string}`; to?: `0x${string}` } }>();
  const { signer } = useStore();
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(() => { invalidate(); });
  const [to, setTo] = useState(route.params?.to ?? "");
  const [assetAddr, setAssetAddr] = useState(route.params?.asset ?? vault.assets[0]?.address);
  const [pickRecipient, setPickRecipient] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWhy, setShowWhy] = useState(true);
  const asset = vault.assets.find((a) => a.address === assetAddr) ?? vault.assets[0];
  const amount = asset ? parseAmount(amountText, asset.decimals) : null;
  const ok = isAddress(to) && amount !== null && amount > 0n && Boolean(asset);

  useEffect(() => {
    if (!ok || !asset || amount === null) { setPreview(null); setPreviewError(null); return; }
    let live = true; setLoading(true);
    (async () => {
      try {
        const [r, rec] = await Promise.all([
          publicClient.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "previewTransfer", args: [asset.address, to as `0x${string}`, amount] }),
          publicClient.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "getRecipient", args: [to as `0x${string}`] }),
        ]);
        if (!live) return;
        setPreview({ tier: Number(r.tier) as Tier, reasons: Number(r.reasons), exposureBps: Number(r.exposureBps), requiredApprovals: Number(r.requiredApprovals), requiredGuardians: Number(r.requiredGuardians), delay: Number(r.delay), trust: Number(rec.trust) as Trust });
        setPreviewError(null);
      } catch (e) { if (live) { setPreview(null); setPreviewError(describeError(e)); } }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [ok, to, assetAddr, amountText, vault.address, asset, amount]);

  const submit = () => { if (!asset || amount === null) return; void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeTransfer", args: [asset.address, to as `0x${string}`, amount, memo] }); };
  const remaining = asset && amount !== null ? asset.balance - amount : 0n;
  const reasons = preview ? explainReasons(preview.reasons) : [];
  const done = tx.state.phase === "done";

  return (
    <Screen
      top={<TopBar left={<BackButton onPress={() => nav.goBack()} />} center={<Text style={s.topTitle}>Send</Text>} />}
      footer={
        <View>
          <TxStatus state={tx.state} />
          <View style={{ height: 10 }} />
          {done ? <Button icon="list" onPress={() => nav.navigate("Main", { screen: "Transactions" })}>Open the queue</Button>
            : <SignBar label="Propose payment" signerAddress={signer?.address} onPress={submit} disabled={!preview || tx.busy} loading={tx.busy} hint={!signer ? "Add a signer key under Settings to propose" : !preview && !loading ? "Fill in the recipient and amount" : undefined} />}
        </View>
      }>
      <Card style={{ alignItems: "center", paddingVertical: 20 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          {vault.assets.map((a) => (
            <Pressable key={a.address} onPress={() => setAssetAddr(a.address)} style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.card2 }, a.address === assetAddr && { backgroundColor: C.accent }]}>
              <TokenMark symbol={a.symbol} size={20} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: a.address === assetAddr ? C.onAccent : C.text }}>{a.symbol}</Text>
            </Pressable>
          ))}
        </View>
        <Input big value={amountText} onChangeText={setAmountText} placeholder="0.00" keyboardType="decimal-pad" />
        <Text style={s.rowSub}>{asset ? `Vault holds ${fmtAmount(asset.balance, asset.decimals, asset.symbol)}` : ""}</Text>
      </Card>
      <Card>
        <Field label="Recipient address" hint="A new address waits out its activation delay.">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isAddress(to) ? <Identicon address={to} size={32} /> : <CircleIcon name="user" size={32} />}
            <Input value={to} onChangeText={(t) => setTo(t.trim())} placeholder="0x…" mono style={{ flex: 1 }} />
            {vault.recipients.length > 0 && <IconButton name="book" onPress={() => setPickRecipient(true)} />}
            <IconButton name="maximize" onPress={() => { scanBus.request((a) => setTo(a)); nav.navigate("Scan"); }} />
          </View>
        </Field>
        <Field label="Purpose" hint="Recorded onchain with the proposal.">
          <Input value={memo} onChangeText={setMemo} placeholder="Invoice 1042, design retainer" maxLength={140} />
        </Field>
      </Card>
      {loading && <Notice tone="info">Asking the vault how it scores this payment…</Notice>}
      {previewError && <Notice tone="bad">{previewError}</Notice>}
      {preview && asset && amount !== null && (
        <>
          <Card flush>
            <Row leading={<CircleIcon name="shield" size={36} tone={preview.tier === Tier.LOW ? "success" : preview.tier === Tier.HIGH ? "warn" : "error"} />} title="Transaction checks" subtitle={`${TIER_LABEL[preview.tier]} · ${preview.requiredApprovals} approval${preview.requiredApprovals === 1 ? "" : "s"}${preview.requiredGuardians ? ` + ${preview.requiredGuardians} guardian` : ""}${preview.delay ? ` · after ${fmtDuration(preview.delay)}` : " · no delay"}`} trailing={<TierBadge tier={preview.tier} />} chevron onPress={() => setShowWhy((v) => !v)} last={!showWhy} />
            {showWhy && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <KV k="Sends" v={`${fmtAmount(amount, asset.decimals, asset.symbol)} to ${short(to)}`} />
                <KV k="Treasury impact" v={`${fmtBps(preview.exposureBps)} · ${fmtAmount(remaining < 0n ? 0n : remaining, asset.decimals, asset.symbol)} remains`} />
                <KV k="Recipient" v={<Badge tone={preview.trust === Trust.UNKNOWN || preview.trust === Trust.NEW ? "info" : "ok"}>{TRUST_LABEL[preview.trust]}{preview.trust === Trust.UNKNOWN ? " · registered as New" : ""}</Badge>} last={reasons.length === 0} />
                {reasons.length > 0 && <View style={{ paddingTop: 10 }}><Text style={s.kvK}>Why this tier</Text>{reasons.map((t) => <Text key={t} style={{ fontFamily: F.body, color: C.text, fontSize: 14, lineHeight: 22 }}>▪ {t}</Text>)}</View>}
              </View>
            )}
          </Card>
        </>
      )}
      <Sheet open={pickRecipient} onClose={() => setPickRecipient(false)} title="Known recipients">
        {vault.recipients.map((r, i) => (
          <Row key={r.address} leading={<Identicon address={r.address} size={36} />} title={short(r.address, 6)} subtitle={`${r.paymentCount.toString()} payment${r.paymentCount === 1n ? "" : "s"}`} trailing={<TrustBadge trust={r.trust} />} onPress={() => { setTo(r.address); setPickRecipient(false); }} last={i === vault.recipients.length - 1} />
        ))}
      </Sheet>
    </Screen>
  );
}
