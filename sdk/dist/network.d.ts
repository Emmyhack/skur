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
export declare const GRPC_ENDPOINTS: Record<Network, string>;
export declare const GRAPHQL_ENDPOINTS: Record<Network, string>;
/** The shared `Clock` every time-dependent entry function reads. */
export declare const CLOCK_ID = "0x6";
export declare function grpcClient(network: Network, baseUrl?: string): SuiGrpcClient;
export declare function graphqlClient(network: Network, url?: string): SuiGraphQLClient<{}>;
/**
 * Where the package and its vaults live. One object per environment, written by the deploy
 * script, so nothing in the app hardcodes an address.
 */
export type Deployment = {
    network: Network;
    /** The published `skur` package. */
    packageId: string;
    /** Vaults the deploy script created, for demos and for the explorer links in the docs. */
    vaults: {
        id: string;
        name: string;
    }[];
    publishedAtDigest?: string;
    publishedAtCheckpoint?: string;
};
export type SkurConfig = {
    deployment: Deployment;
    client: ClientWithCoreApi;
};
/** Fully qualified Move type for a struct in the deployed package. */
export declare function moveType(packageId: string, module: string, name: string): string;
export declare function moveTarget(packageId: string, module: string, fn: string): `${string}::${string}::${string}`;
//# sourceMappingURL=network.d.ts.map