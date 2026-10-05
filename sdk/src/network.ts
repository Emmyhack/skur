import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import type { ClientWithCoreApi } from '@mysten/sui/client';

/**
 * Transport policy for this project: gRPC first, GraphQL where a query needs shapes gRPC's
 * unified methods do not carry.
 *
 * JSON-RPC is deliberately absent. It was switched off on Sui Foundation mainnet full nodes in
 * the week of 27 July 2026 and is scheduled for full removal, code included, in mid-October 2026.
 * Nothing here may depend on it, including transitively: `@mysten/dapp-kit` 1.x is JSON-RPC only
 * and is why the frontend uses `@mysten/dapp-kit-react` 2.x instead.
 */
export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export const GRPC_ENDPOINTS: Record<Network, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000',
};

export const GRAPHQL_ENDPOINTS: Record<Network, string> = {
  mainnet: 'https://sui-mainnet.mystenlabs.com/graphql',
  testnet: 'https://sui-testnet.mystenlabs.com/graphql',
  devnet: 'https://sui-devnet.mystenlabs.com/graphql',
  localnet: 'http://127.0.0.1:9125/graphql',
};

/** The shared `Clock` every time-dependent entry function reads. */
export const CLOCK_ID = '0x6';

export function grpcClient(network: Network, baseUrl = GRPC_ENDPOINTS[network]) {
  return new SuiGrpcClient({ network, baseUrl });
}

export function graphqlClient(network: Network, url = GRAPHQL_ENDPOINTS[network]) {
  return new SuiGraphQLClient({ network, url });
}

/**
 * Where the package and its vaults live. One object per environment, written by the deploy
 * script, so nothing in the app hardcodes an address.
 */
export type Deployment = {
  network: Network;
  /** The published `skur` package. */
  packageId: string;
  /** Vaults the deploy script created, for demos and for the explorer links in the docs. */
  vaults: { id: string; name: string }[];
  publishedAtDigest?: string;
  publishedAtCheckpoint?: string;
};

export type SkurConfig = {
  deployment: Deployment;
  client: ClientWithCoreApi;
};

/** Fully qualified Move type for a struct in the deployed package. */
export function moveType(packageId: string, module: string, name: string) {
  return `${packageId}::${module}::${name}`;
}

export function moveTarget(
  packageId: string,
  module: string,
  fn: string,
): `${string}::${string}::${string}` {
  return `${packageId}::${module}::${fn}`;
}
