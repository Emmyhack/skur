import { config } from './config.ts';
import { pool } from './db.ts';
import { makeApi } from './api.ts';
import { runIndexer } from './indexer.ts';

/**
 * One process runs both the indexer and the read API. They share a pool and a cursor, and keeping
 * them together means a deployment cannot end up with an API serving a store nothing is filling.
 * Split them when there is a reason to; `npm run index` already runs the indexer alone.
 */
const ac = new AbortController();
const server = makeApi().listen(config.port, () => {
  console.log(`api on :${config.port} (${config.network})`);
});

runIndexer(ac.signal);

async function shutdown() {
  ac.abort();
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
