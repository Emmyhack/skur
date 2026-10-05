import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
export const GRPC_ENDPOINTS = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
    localnet: 'http://127.0.0.1:9000',
};
export const GRAPHQL_ENDPOINTS = {
    mainnet: 'https://sui-mainnet.mystenlabs.com/graphql',
    testnet: 'https://sui-testnet.mystenlabs.com/graphql',
    devnet: 'https://sui-devnet.mystenlabs.com/graphql',
    localnet: 'http://127.0.0.1:9125/graphql',
};
/** The shared `Clock` every time-dependent entry function reads. */
export const CLOCK_ID = '0x6';
export function grpcClient(network, baseUrl = GRPC_ENDPOINTS[network]) {
    return new SuiGrpcClient({ network, baseUrl });
}
export function graphqlClient(network, url = GRAPHQL_ENDPOINTS[network]) {
    return new SuiGraphQLClient({ network, url });
}
/** Fully qualified Move type for a struct in the deployed package. */
export function moveType(packageId, module, name) {
    return `${packageId}::${module}::${name}`;
}
export function moveTarget(packageId, module, fn) {
    return `${packageId}::${module}::${fn}`;
}
//# sourceMappingURL=network.js.map