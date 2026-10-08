import { grpcClient, listVaultEvents } from '@skur/sdk';
import { config } from './config.ts';
import { pool, withTx } from './db.ts';
import { ensureVault, project } from './project.ts';
import { deliverPending, queueNotifications } from './notify.ts';

/**
 * The indexer.
 *
 * It walks the package's events forwards from a stored cursor, projects each one, queues whatever
 * notifications it implies, and only then advances the cursor — so a crash re-reads a batch rather
 * than skipping it, and every write is idempotent on the event's ledger position to make that
 * safe.
 *
 * Transport is gRPC. `hasNextPage` can be true with an empty page because a gRPC server bounds how
 * much ledger one request scans, so the loop keeps going while the server says there is more
 * rather than stopping on an empty result.
 */
const client = grpcClient(config.network, config.grpcUrl);

async function readCursor(): Promise<string | null> {
  const { rows } = await pool.query<{ cursor: string | null }>(
    `SELECT cursor FROM indexer_cursor WHERE network = $1`,
    [config.network],
  );
  if (rows.length === 0) {
    await pool.query(`INSERT INTO indexer_cursor (network) VALUES ($1)`, [config.network]);
    return null;
  }
  return rows[0].cursor;
}

export async function indexOnce(): Promise<{ events: number; notifications: number; done: boolean }> {
  const cursor = await readCursor();
  const page = await listVaultEvents(client, {
    packageId: config.packageId,
    limit: config.batchSize,
    // No cursor yet means the start of the package's history, read oldest first.
    ...(cursor ? { after: cursor } : { order: 'ascending' as const }),
  });

  if (page.events.length === 0) {
    if (page.hasNextPage && page.endCursor) {
      // A scan-limited page: nothing matched in the range read, but moving the cursor makes
      // progress rather than reading the same empty range forever.
      await pool.query(
        `UPDATE indexer_cursor SET cursor = $2, updated_at = now() WHERE network = $1`,
        [config.network, page.endCursor],
      );
    }
    return { events: 0, notifications: 0, done: !page.hasNextPage };
  }

  const notifications = await withTx(async (c) => {
    let queued = 0;
    for (const decoded of page.events) {
      await ensureVault(c, config.network, decoded.event);
      // `events` is the idempotency gate: if the row is already there, this event has been
      // applied and its counters must not be moved again.
      const seen = await c.query(
        `SELECT 1 FROM events WHERE network = $1 AND tx_digest = $2 AND event_index = $3`,
        [config.network, decoded.position.transactionDigest, decoded.position.eventIndex],
      );
      if (seen.rowCount) continue;
      await project(c, config.network, decoded);
      queued += await queueNotifications(c, config.network, decoded);
    }
    const last = page.events[page.events.length - 1];
    await c.query(
      `UPDATE indexer_cursor
          SET cursor = $2, last_event_at = $3, events_seen = events_seen + $4, updated_at = now()
        WHERE network = $1`,
      [
        config.network,
        page.endCursor,
        new Date(last.event.at),
        page.events.length,
      ],
    );
    return queued;
  });

  return { events: page.events.length, notifications, done: !page.hasNextPage };
}

/** Catch up to the tip, then poll. */
export async function runIndexer(signal?: AbortSignal) {
  console.log(`indexing ${config.packageId} on ${config.network}`);
  while (!signal?.aborted) {
    try {
      let done = false;
      while (!done && !signal?.aborted) {
        const r = await indexOnce();
        done = r.done;
        if (r.events) {
          console.log(`+${r.events} events, ${r.notifications} notifications queued`);
        }
      }
      const sent = await deliverPending();
      if (sent) console.log(`delivered ${sent} notifications`);
    } catch (e) {
      console.error('index pass failed:', e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, config.indexIntervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ac = new AbortController();
  process.on('SIGINT', () => ac.abort());
  process.on('SIGTERM', () => ac.abort());
  runIndexer(ac.signal).then(() => pool.end());
}
