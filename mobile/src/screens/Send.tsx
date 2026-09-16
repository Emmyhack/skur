import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurVaultAbi } from "@web/abi/SkurVault";
import { fmtAmount, fmtBps, fmtDuration, parseAmount, short } from "@web/lib/format";
import { describeError } from "@web/lib/errors";
import { explainReasons, Tier, TIER_LABEL, Trust, TRUST_LABEL } from "@web/lib/types";
import type { VaultData } from "@web/lib/vaultReads";
import { publicClient } from "../lib/client";
import { useInvalidateVault } from "../hooks/useVault";
import { useTx } from "../hooks/useTx";
import { Button, Card, Field, Input, KV, Notice, Screen, TierBadge, TxStatus, s } from "../components/ui";
import { C, F } from "../theme";

type Preview = { tier: Tier; reasons: number; exposureBps: number; requiredApprovals: number; requiredGuardians: number; delay: number; trust: Trust; activatesAt: bigint };

/** Send flow: the vault itself classifies the payment before anything is signed. */
export function Send({ vault }: { vault: VaultData }) {
  const nav = useNavigation<{ goBack: () => void; navigate: (n: string, p?: object) => void }>();
  const invalidate = useInvalidateVault(vault.address);
  const tx = useTx(() => { invalidate(); });
  const [to, setTo] = useState("");
  const [assetAddr, setAssetAddr] = useState(vault.assets[0]?.address);
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const asset = vault.assets.find((a) => a.address === assetAddr) ?? vault.assets[0];
  const amount = asset ? parseAmount(amountText, asset.decimals) : null;
  const ok = isAddress(to) && amount !== null && amount > 0n && Boolean(asset);

  useEffect(() => {
    if (!ok || !asset || amount === null) { setPreview(null); setPreviewError(null); return; }
    let live = true;
    setLoading(true);
    (async () => {
      try {
        const [r, rec] = await Promise.all([
          publicClient.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "previewTransfer", args: [asset.address, to as `0x${string}`, amount] }),
          publicClient.readContract({ address: vault.address, abi: SkurVaultAbi, functionName: "getRecipient", args: [to as `0x${string}`] }),
        ]);
        if (!live) return;
        setPreview({ tier: Number(r.tier) as Tier, reasons: Number(r.reasons), exposureBps: Number(r.exposureBps), requiredApprovals: Number(r.requiredApprovals), requiredGuardians: Number(r.requiredGuardians), delay: Number(r.delay), trust: Number(rec.trust) as Trust, activatesAt: rec.activatesAt });
        setPreviewError(null);
      } catch (e) { if (live) { setPreview(null); setPreviewError(describeError(e)); } }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [ok, to, assetAddr, amountText, vault.address, asset, amount]);

  const submit = () => { if (!asset || amount === null) return; void tx.send({ address: vault.address, abi: SkurVaultAbi, functionName: "proposeTransfer", args: [asset.address, to as `0x${string}`, amount, memo] }); };
  const remaining = asset && amount !== null ? asset.balance - amount : 0n;

  return (
    <Screen title="Send tokens" sub="Scored by the vault before you sign">
      <Card>
        <Field label="Recipient address" hint="An address this vault has never paid is registered as New and waits out its activation delay first.">
          <Input value={to} onChangeText={(t) => setTo(t.trim())} placeholder="0x…" mono />
        </Field>
        <Field label="Asset">
          <View style={{ flexDirection: "row", gap: 8 }}>
            {vault.assets.map((a) => (
              <Pressable key={a.address} onPress={() => setAssetAddr(a.address)} style={[s.segItem, { flex: 0, paddingHorizontal: 14, backgroundColor: a.address === assetAddr ? C.accent : C.panel2 }]}><Text style={[s.segText, a.address === assetAddr && { color: C.onAccent }]}>{a.symbol}</Text></Pressable>
            ))}
          </View>
        </Field>
        <Field label="Amount" hint={asset ? `Vault holds ${fmtAmount(asset.balance, asset.decimals, asset.symbol)}` : undefined}>
          <Input value={amountText} onChangeText={setAmountText} placeholder="0.00" keyboardType="decimal-pad" />
        </Field>
        <Field label="Purpose" hint="Recorded onchain with the proposal, so approvers know what they are signing.">
          <Input value={memo} onChangeText={setMemo} placeholder="Invoice 1042, design retainer" maxLength={140} />
        </Field>
      </Card>
      {loading && <Notice tone="info">Asking the vault how it scores this payment…</Notice>}
      {previewError && <Notice tone="bad">{previewError}</Notice>}
      {preview && asset && amount !== null && (
        <Card title="Review">
          <KV k="Action" v={`Send ${fmtAmount(amount, asset.decimals, asset.symbol)} to ${short(to)}`} />
          <KV k="Treasury impact" v={`${fmtBps(preview.exposureBps)} of holdings · ${fmtAmount(remaining < 0n ? 0n : remaining, asset.decimals, asset.symbol)} remains`} />
          <KV k="Recipient" v={`${TRUST_LABEL[preview.trust]}${preview.trust === Trust.UNKNOWN ? " · will be registered as New" : ""}`} />
          <KV k="Risk tier" v={<TierBadge tier={preview.tier} />} />
          <KV k="Requirement" v={`${TIER_LABEL[preview.tier]} · ${preview.requiredApprovals} approval${preview.requiredApprovals === 1 ? "" : "s"}${preview.requiredGuardians ? ` + ${preview.requiredGuardians} guardian` : ""}${preview.delay ? ` · after ${fmtDuration(preview.delay)}` : " · no delay"}`} last={explainReasons(preview.reasons).length === 0} />
          {explainReasons(preview.reasons).length > 0 && (
            <View style={{ paddingTop: 10 }}>
              <Text style={s.kvK}>Why this tier</Text>
              {explainReasons(preview.reasons).map((t) => <Text key={t} style={{ fontFamily: F.body, color: C.text, fontSize: 14, lineHeight: 22 }}>▪ {t}</Text>)}
            </View>
          )}
        </Card>
      )}
      <Button disabled={!preview || tx.busy || tx.state.phase === "done"} loading={tx.busy} onPress={submit}>Propose payment</Button>
      <TxStatus state={tx.state} />
      {tx.state.phase === "done" && <Button kind="secondary" style={{ marginTop: 10 }} onPress={() => nav.navigate("Main", { screen: "Transactions" })}>Open the queue</Button>}
      <Button kind="ghost" onPress={() => nav.goBack()}>Back</Button>
    </Screen>
  );
}
