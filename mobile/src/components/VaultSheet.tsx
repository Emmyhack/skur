import { useEffect, useState } from "react";
import { useTheme } from "../state/theme";
import { Text, View } from "react-native";
import { isAddress } from "viem";
import { SkurFactoryAbi } from "@web/abi/SkurFactory";
import { DEPLOYMENTS } from "@web/config/chain";
import { short } from "@web/lib/format";
import { publicClient } from "../lib/client";
import { useStore } from "../state/store";
import { Identicon } from "./Identicon";
import { Button, CircleIcon, Icon, Input, Logo, Row, Sheet, useStyles } from "./ui";
import { F } from "../theme";

/** Safe's "My accounts" switcher: the open vault, vaults the device signer belongs to, and a way to add one by address. */
export function VaultSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const C = useTheme(); const s = useStyles();
  const { vaultAddress, setVaultAddress, labels, signer } = useStore();
  const [mine, setMine] = useState<`0x${string}`[]>([]);
  const [adding, setAdding] = useState(false);
  const [addr, setAddr] = useState("");
  useEffect(() => {
    if (!open || !signer) return;
    publicClient.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [signer.address] }).then((v) => setMine([...v])).catch(() => setMine([]));
  }, [open, signer]);
  const list = Array.from(new Set([...(vaultAddress ? [vaultAddress] : []), ...mine, DEPLOYMENTS.demoVault].map((a) => a.toLowerCase()))) as `0x${string}`[];
  const pick = (a: `0x${string}`) => { void setVaultAddress(a); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="My vaults" action={<Logo size={22} wordmark={false} />}>
      <View style={{ backgroundColor: C.canvas, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
        {list.map((a, i) => {
          const current = vaultAddress?.toLowerCase() === a;
          return (
            <Row key={a} leading={<Identicon address={a} size={40} />} title={labels[a] ?? (a === DEPLOYMENTS.demoVault.toLowerCase() ? "Demo vault" : "Treasury vault")} subtitle={short(a, 6)} onPress={() => pick(a)} last={i === list.length - 1}
              trailing={current ? <Icon name="check" size={18} color={C.accent} /> : mine.some((m) => m.toLowerCase() === a) ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.text3 }}>member</Text> : null} />
          );
        })}
      </View>
      {adding ? (
        <View style={{ gap: 10 }}>
          <Input value={addr} onChangeText={(t) => setAddr(t.trim())} placeholder="0x… vault address" mono autoFocus />
          <Button disabled={!isAddress(addr)} onPress={() => pick(addr as `0x${string}`)}>Open vault</Button>
        </View>
      ) : (
        <Row leading={<CircleIcon name="plus" size={36} />} title="Add existing vault" subtitle="Open any vault by its address" onPress={() => setAdding(true)} last />
      )}
      {!signer && <Text style={s.hint}>Add a signer key under Settings and the vaults it belongs to appear here.</Text>}
    </Sheet>
  );
}
