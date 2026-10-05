import type { Network } from '@skur/sdk';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set; copy .env.example and fill it in`);
  return v;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  network: (process.env.SKUR_NETWORK ?? 'testnet') as Network,
  packageId: required('SKUR_PACKAGE_ID'),
  grpcUrl: process.env.SKUR_GRPC_URL,
  indexIntervalMs: Number(process.env.INDEX_INTERVAL_MS ?? 4000),
  port: Number(process.env.PORT ?? 8787),
  /** Page size for each pass of the indexer. */
  batchSize: Number(process.env.INDEX_BATCH ?? 50),
};
