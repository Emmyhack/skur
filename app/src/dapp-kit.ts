import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GRPC_ENDPOINTS } from '@skur/sdk';
import { NETWORK } from './config';

/**
 * One dApp Kit instance for the app.
 *
 * The client is `SuiGrpcClient`. This is the reason the app is on `@mysten/dapp-kit-react` 2.x and
 * not `@mysten/dapp-kit` 1.x: the older package only speaks JSON-RPC, which Sui is in the middle
 * of decommissioning.
 */
export const dAppKit = createDAppKit({
  // One build, one network. dApp Kit persists the selected network in the browser, and a list
  // here let a stale 'localnet' from an earlier session be restored over the build's own
  // setting — the wallet then received sign requests stamped for a chain it has never heard
  // of and answered with an empty error. With a single entry there is nothing to restore.
  networks: [NETWORK] as const,
  defaultNetwork: NETWORK,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: process.env.NEXT_PUBLIC_SKUR_GRPC_URL ?? GRPC_ENDPOINTS[network],
    }),
  autoConnect: true,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
