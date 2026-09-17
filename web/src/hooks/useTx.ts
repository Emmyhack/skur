import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { wagmiConfig } from "../wagmi";
import type { Abi } from "viem";
import { describeError } from "../lib/errors";
import { arkDevnet } from "../config/chain";

export type TxState =
  | { phase: "idle" }
  | { phase: "simulating" }
  | { phase: "signing" }
  | { phase: "mining"; hash: `0x${string}` }
  | { phase: "done"; hash: `0x${string}` }
  | { phase: "error"; message: string };

/**
 * Simulate, sign, wait. Simulation runs first so a policy refusal surfaces as a readable custom error
 * before the wallet ever asks for a signature (human-readable intent before signing).
 */
export function useTx(onDone?: () => void) {
  const { data: walletForChain } = useWalletClient({ chainId: arkDevnet.id });
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const send = useCallback(
    async (args: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }) => {
      if (!client || !isConnected) {
        setState({ phase: "error", message: "Connect a wallet to continue." });
        return;
      }
      let wallet = walletForChain;
      // A connected wallet on another network yields no client for this chain: ask it to switch first.
      if (!wallet || chainId !== arkDevnet.id) {
        try {
          setState({ phase: "signing" });
          await switchChainAsync({ chainId: arkDevnet.id });
          wallet = await getWalletClient(wagmiConfig, { chainId: arkDevnet.id });
        } catch {
          setState({ phase: "error", message: `Your wallet is on another network. Switch it to Ark Constellation devnet (chain ${arkDevnet.id}) and try again.` });
          return;
        }
      }
      try {
        setState({ phase: "simulating" });
        const { request } = await client.simulateContract({
          ...args,
          account: wallet.account,
          chain: arkDevnet,
        } as Parameters<typeof client.simulateContract>[0]);
        setState({ phase: "signing" });
        const hash = await wallet.writeContract(request);
        setState({ phase: "mining", hash });
        await client.waitForTransactionReceipt({ hash });
        setState({ phase: "done", hash });
        onDone?.();
      } catch (e) {
        setState({ phase: "error", message: describeError(e) });
      }
    },
    [walletForChain, client, isConnected, chainId, switchChainAsync, onDone],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, send, reset, busy: state.phase === "simulating" || state.phase === "signing" || state.phase === "mining" };
}

export { describeError } from "../lib/errors";
