import './polyfills';
import * as grpc from '@mysten/sui/grpc';
import { GRPC_URL, NETWORK } from './config';
import type { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * One client for the app, built on first use rather than at import.
 *
 * Constructing it at module scope means any resolution problem in the SDK throws during module
 * initialisation — before React mounts, with no component tree to show an error in, and no stack
 * that names the cause. Lazily, a failure is a message on a screen.
 *
 * gRPC, not JSON-RPC: Sui switched JSON-RPC off on mainnet full nodes in July 2026 and is removing
 * it. The transport is gRPC-web over fetch, which is what React Native can actually do — there is
 * no HTTP/2 socket to reach for here.
 */
let instance: SuiGrpcClient | null = null;

export function getClient(): SuiGrpcClient {
  if (instance) return instance;
  const Ctor = grpc.SuiGrpcClient;
  if (typeof Ctor !== 'function') {
    throw new Error(
      `@mysten/sui/grpc did not provide SuiGrpcClient under this bundler. Got ${typeof Ctor}; the module exported: ${Object.keys(grpc).join(', ') || '(nothing)'}`,
    );
  }
  instance = new Ctor({ network: NETWORK, baseUrl: GRPC_URL });
  return instance;
}

/**
 * A proxy, so callers can keep writing `client.core.getObject(...)` while construction stays
 * lazy. Every property access builds the client on first touch.
 */
export const client = new Proxy({} as SuiGrpcClient, {
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
