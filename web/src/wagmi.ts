import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arkDevnet } from "./config/chain";

export const wagmiConfig = createConfig({
  chains: [arkDevnet],
  connectors: [injected()],
  transports: {
    [arkDevnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
