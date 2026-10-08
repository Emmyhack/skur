import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';
import { pool, withTx } from './db.ts';

/**
 * Migrations are plain SQL, applied in filename order, recorded by name. There is no down path:
 * a projection store is rebuilt from events rather than migrated backwards.
 */
const dir = new URL('../migrations/', import.meta.url).pathname;

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    await withTx(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`applied ${file}`);
  }

  await pool.query(
    `INSERT INTO networks (name, package_id) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET package_id = EXCLUDED.package_id`,
    [config.network, config.packageId],
  );
  await pool.query(
    `INSERT INTO indexer_cursor (network) VALUES ($1) ON CONFLICT (network) DO NOTHING`,
    [config.network],
  );
  console.log(`ready: ${config.network} at ${config.packageId}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
