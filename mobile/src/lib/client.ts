import './polyfills';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GRPC_URL, NETWORK } from './config';

/**
 * One client for the app.
 *
 * gRPC, not JSON-RPC: Sui switched JSON-RPC off on mainnet full nodes in July 2026 and is
 * removing it entirely. The default transport is gRPC-web over fetch, which is what React Native
 * can actually do — there is no HTTP/2 socket to reach for here.
 */
export const client = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC_URL });
