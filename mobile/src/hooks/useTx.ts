import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useState } from "react";
import { createWalletClient, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkDevnet, ARK_DEVNET_RPC } from "@web/config/chain";
import { describeError } from "@web/lib/errors";
import { publicClient } from "../lib/client";
import { useStore } from "../state/store";

export type TxState =
  | { phase: "idle" }
  | { phase: "auth" }
  | { phase: "simulating" }
  | { phase: "mining"; hash: `0x${string}` }
  | { phase: "done"; hash: `0x${string}` }
  | { phase: "error"; message: string };

/**
 * Sign with the device key. Order: biometric gate, simulation (so a policy refusal reads as plain language before
 * anything is signed), sign and broadcast, wait for the receipt.
 */
export function useTx(onDone?: () => void) {
  const { signer, biometrics } = useStore();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const send = useCallback(
    async (args: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }) => {
      if (!signer) {
        setState({ phase: "error", message: "Add a signer key under Settings to sign from this device." });
        return;
      }
      try {
        if (biometrics) {
          setState({ phase: "auth" });
          const hw = await LocalAuthentication.hasHardwareAsync();
          const enrolled = hw && (await LocalAuthentication.isEnrolledAsync());
          if (enrolled) {
            const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Approve with Skur", cancelLabel: "Cancel" });
            if (!r.success) {
              setState({ phase: "error", message: "Authentication cancelled. Nothing was signed." });
              return;
            }
          }
        }
        setState({ phase: "simulating" });
        const account = privateKeyToAccount(signer.key);
        const wallet = createWalletClient({ account, chain: arkDevnet, transport: http(ARK_DEVNET_RPC) });
        const { request } = await publicClient.simulateContract({ ...args, account, chain: arkDevnet } as Parameters<typeof publicClient.simulateContract>[0]);
        const hash = await wallet.writeContract(request);
        setState({ phase: "mining", hash });
        await publicClient.waitForTransactionReceipt({ hash });
        setState({ phase: "done", hash });
        onDone?.();
      } catch (e) {
        setState({ phase: "error", message: describeError(e) });
      }
    },
    [signer, biometrics, onDone],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, send, reset, busy: state.phase === "auth" || state.phase === "simulating" || state.phase === "mining" };
}
