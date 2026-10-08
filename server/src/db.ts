import { Pool, type PoolClient } from 'pg';
import { config } from './config.ts';

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

/** Run a unit of work in one transaction, rolling back on any throw. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Postgres has no u64, and amounts can exceed a double. NUMERIC in, bigint out. */
export function toNumeric(v: bigint): string {
  return v.toString();
}

export function fromNumeric(v: string | number | null | undefined): bigint {
  if (v === null || v === undefined) return 0n;
  return BigInt(String(v).split('.')[0]);
}

/** Move timestamps are milliseconds since the epoch. */
export function toTimestamp(ms: number): Date {
  return new Date(ms);
}
