import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arkDevnet } from "./config/chain";

export const wagmiConfig = createConfig({
  chains: [arkDevnet],
  connectors: [injected()],
  transports: {
    // The devnet RPC answers in 1.5-2s per round trip and has no Multicall3, but it accepts JSON-RPC
    // batches, so every parallel read in a tick collapses into one request.
    [arkDevnet.id]: http(undefined, { batch: { batchSize: 50, wait: 16 } }),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
