import Constants from 'expo-constants';
import { GRPC_ENDPOINTS, type Network } from '@skur/sdk';

/**
 * Where this build points. `EXPO_PUBLIC_*` wins, then app.json's `extra`, then the defaults —
 * so a developer can point a build at their own publish without editing a committed file.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function setting(key: string, fallback: string): string {
  return process.env[`EXPO_PUBLIC_${key}`] ?? extra[key] ?? fallback;
}

export const NETWORK = setting('SKUR_NETWORK', 'testnet') as Network;
export const PACKAGE_ID = setting('SKUR_PACKAGE_ID', '0x0');
export const GRPC_URL = setting('SKUR_GRPC_URL', GRPC_ENDPOINTS[NETWORK]);
/** The indexer. Optional: every screen reads the chain directly without it. */
export const API_URL = setting('SKUR_API', '');

export const CONFIGURED = PACKAGE_ID !== '0x0';

export const explorer = (kind: 'object' | 'tx', id: string) =>
  `https://suiscan.xyz/${NETWORK}/${kind}/${id}`;
