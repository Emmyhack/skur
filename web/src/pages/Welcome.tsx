import { useState } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { isAddress } from "viem";
import { SkurFactoryAbi } from "../abi/SkurFactory";
import { DEPLOYMENTS } from "../config/chain";
import { Button, Field } from "../components/ui";
import { NetworkGuard } from "../components/NetworkGuard";
import { Identicon } from "../components/Identicon";
import { IconArrowRight, IconWallet } from "../components/icons";
import { short } from "../lib/format";

/** app.safe.global/welcome: a centred "Get started" card on a dark canvas. */
export function Welcome({ onOpen, onCreate, onLanding }: { onOpen: (a: `0x${string}`) => void; onCreate: () => void; onLanding: () => void }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const client = usePublicClient();
  const [tab, setTab] = useState<"accounts" | "watch">("accounts");
  const [watch, setWatch] = useState("");
  const [mine, setMine] = useState<`0x${string}`[] | null>(null);

  const loadMine = async () => {
    if (!client || !address) return;
    const v = await client.readContract({ address: DEPLOYMENTS.factory, abi: SkurFactoryAbi, functionName: "vaultsOf", args: [address] }).catch(() => []);
    setMine([...v]);
  };

  return (
    <div className="entry">
      <div className="entry-top">
        <button className="logo" onClick={onLanding} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer" }}>
          <span className="mark">S</span>
        </button>
        <div className="tools-pill">
          <NetworkGuard />
          {isConnected && address ? (
            <Button kind="secondary" className="on" onClick={() => disconnect()} icon={<Identicon address={address} size={18} />}>{short(address)}</Button>
          ) : (
            connectors.slice(0, 1).map((c) => (
              <Button key={c.uid} kind="secondary" onClick={() => connect({ connector: c })} disabled={isPending} icon={<IconWallet width={16} height={16} />}>Connect Wallet</Button>
            ))
          )}
        </div>
      </div>

      <div className="entry-center">
        <div className="segmented">
          <button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>My vaults</button>
          <button className={tab === "watch" ? "active" : ""} onClick={() => setTab("watch")}>Watch a vault</button>
        </div>
        <div className="entry-note">
          <span className="tag-new">New</span> Skur V1 is live on the Ark Constellation devnet <IconArrowRight width={16} height={16} style={{ marginLeft: "auto", color: "var(--accent)" }} />
        </div>

        {tab === "accounts" ? (
          <div className="entry-card">
            <div className="wordmark-lg"><span className="mark" style={{ width: 28, height: 28, borderRadius: 4, background: "var(--accent)", color: "#212529", display: "grid", placeItems: "center", fontSize: 15 }}>S</span><span style={{ fontFamily: "Space Grotesk, sans-serif" }}>Skur</span></div>
            <h2>Get started</h2>
            <p>Connect a wallet to create a vault, or open one you belong to.</p>
            {isConnected && address ? (
              <>
                <Button block onClick={onCreate}>Create new vault</Button>
                <div className="or">OR</div>
                {mine === null ? (
                  <button className="link accent" onClick={loadMine}>Find vaults this wallet belongs to</button>
                ) : mine.length === 0 ? (
                  <p className="caption">This wallet is not a member of any vault yet. You can still open any vault by address.</p>
                ) : (
                  <div className="stack" style={{ textAlign: "left" }}>
                    {mine.map((v) => (
                      <button key={v} className="btn btn-dark btn-block" style={{ justifyContent: "flex-start" }} onClick={() => onOpen(v)}>
                        <Identicon address={v} size={20} /> <code>{short(v, 6)}</code>
                      </button>
                    ))}
                  </div>
                )}
                {DEPLOYMENTS.demoVault && (
                  <p className="caption" style={{ marginTop: 16, marginBottom: 0 }}>
                    or open the <button className="link accent" onClick={() => onOpen(DEPLOYMENTS.demoVault)}>demo vault</button>
                  </p>
                )}
              </>
            ) : (
              <>
                {connectors.slice(0, 1).map((c) => (
                  <Button key={c.uid} block onClick={() => connect({ connector: c })} disabled={isPending} icon={<IconWallet width={16} height={16} />}>Connect wallet</Button>
                ))}
                <div className="or">OR</div>
                <button className="link" onClick={() => setTab("watch")}>Watch any vault</button>
              </>
            )}
          </div>
        ) : (
          <div className="entry-card">
            <div className="wordmark-lg"><span className="mark" style={{ width: 28, height: 28, borderRadius: 4, background: "var(--accent)", color: "#212529", display: "grid", placeItems: "center", fontSize: 15 }}>S</span><span style={{ fontFamily: "Space Grotesk, sans-serif" }}>Skur</span></div>
            <h2>Watch a vault</h2>
            <p>Read any vault's balances, policy and queue. No wallet needed.</p>
            <Field label="Vault address">
              <input value={watch} onChange={(e) => setWatch(e.target.value.trim())} placeholder="0x…" style={{ textAlign: "left" }} />
            </Field>
            <Button block disabled={!isAddress(watch)} onClick={() => onOpen(watch as `0x${string}`)}>Open vault</Button>
            {DEPLOYMENTS.demoVault && (
              <p className="caption" style={{ marginTop: 16, marginBottom: 0 }}>
                or open the <button className="link accent" onClick={() => onOpen(DEPLOYMENTS.demoVault)}>demo vault</button>
              </p>
            )}
          </div>
        )}
        <p className="caption">You interact directly with verified contracts on the Ark Constellation devnet. Skur never holds keys or funds.</p>
      </div>

      <div className="entry-foot">
        <span>Skur V1 · Ark devnet</span>
        <a href="https://github.com/Emmyhack/skur" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://github.com/Emmyhack/skur/blob/main/docs/SECURITY_MODEL.md" target="_blank" rel="noreferrer">Security model</a>
        <a href="https://explorer.34.60.137.196.sslip.io" target="_blank" rel="noreferrer">Explorer</a>
        <a href="https://faucet.34.60.137.196.sslip.io/" target="_blank" rel="noreferrer">Faucet</a>
      </div>
    </div>
  );
}
