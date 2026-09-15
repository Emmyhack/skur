import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arkDevnet } from "./config/chain";

export const wagmiConfig = createConfig({
  chains: [arkDevnet],
  connectors: [injected()],
  transports: {
    // The devnet RPC has no Multicall3 and works through JSON-RPC batches almost serially (about 0.4s
    // per entry), while concurrent single requests come back three times faster. So: no batching.
    [arkDevnet.id]: http(undefined, { retryCount: 2 }),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
