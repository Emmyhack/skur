import type { Network } from '@skur/sdk';
import deployments from './deployments.json';

/**
 * Where the package lives. Published addresses come from `sui/deployments/<network>.json`, copied
 * in by `npm run sync-deployments`, and an environment variable overrides them so a developer can
 * point at their own publish without editing a committed file.
 */
export const NETWORK = (process.env.NEXT_PUBLIC_SKUR_NETWORK ?? 'testnet') as Network;

type Deployment = { network: string; packageId: string; vaults: { id: string; name: string }[] };

const committed = (deployments as Record<string, Deployment>)[NETWORK];

export const PACKAGE_ID = process.env.NEXT_PUBLIC_SKUR_PACKAGE_ID ?? committed?.packageId ?? '0x0';

export const KNOWN_VAULTS = committed?.vaults ?? [];

/** The indexer. Optional: every screen works without it, just with fewer round trips saved. */
export const API_URL = process.env.NEXT_PUBLIC_SKUR_API ?? '';

export const EXPLORER = (kind: 'object' | 'tx', id: string) =>
  `https://suiscan.xyz/${NETWORK}/${kind === 'object' ? 'object' : 'tx'}/${id}`;

export const CONFIGURED = PACKAGE_ID !== '0x0';
