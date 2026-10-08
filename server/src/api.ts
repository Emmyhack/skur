import express, { type Request, type Response } from 'express';
import { fetchVault, grpcClient, Status } from '@skur/sdk';
import { config } from './config.ts';
import { fromNumeric, pool } from './db.ts';
import { describeWait } from './notify.ts';
import { outflow, recipientAdvisory, riskReport } from './advisory.ts';

/**
 * The read API.
 *
 * Deliberately read-only and deliberately not required: every endpoint here answers a question
 * faster than the chain can, and none of them answers one the chain cannot. An interface that
 * loses this service shows a slower dashboard; it does not lose the ability to move money, read
 * the policy or approve a payment. That is the test every endpoint had to pass.
 */
const client = grpcClient(config.network, config.grpcUrl);

/** bigint does not survive JSON.stringify, and silently throwing on it is worse than a string. */
function send(res: Response, body: unknown) {
  res.type('application/json').send(
    JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

/** Express 5 types a route parameter as possibly repeated; these routes take exactly one. */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500);
      send(res, { error: message });
    });
  };
}

export function makeApi() {
  const app = express();
  app.use(express.json());

  // Everything this API serves is public chain state read back out of the indexer; the browser
  // is a first-class client. Without these headers every fetch from the web app dies in CORS
  // preflight and the UI degrades to "the indexer is not reachable".
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', wrap(async (_req, res) => {
    const { rows } = await pool.query<{ cursor: string | null; events_seen: string; last_event_at: Date | null }>(
      `SELECT cursor, events_seen, last_event_at FROM indexer_cursor WHERE network = $1`,
      [config.network],
    );
    send(res, {
      ok: true,
      network: config.network,
      packageId: config.packageId,
      indexer: rows[0] ?? null,
    });
  }));

  app.get('/vaults', wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT v.vault_id, v.name, v.mode, v.policy_version, v.created_at,
              (SELECT count(*) FROM members m WHERE m.network = v.network AND m.vault_id = v.vault_id) AS members,
              (SELECT count(*) FROM proposals p
                WHERE p.network = v.network AND p.vault_id = v.vault_id AND p.status = $2) AS pending
         FROM vaults v WHERE v.network = $1 ORDER BY v.created_at DESC`,
      [config.network, Status.PENDING],
    );
    send(res, { vaults: rows });
  }));

  /** Vaults an address is a member of, which is how an interface finds "my vaults". */
  app.get('/members/:address/vaults', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT m.vault_id, m.roles, v.name, v.mode
         FROM members m JOIN vaults v
           ON v.network = m.network AND v.vault_id = m.vault_id
        WHERE m.network = $1 AND m.address = $2
        ORDER BY v.created_at DESC`,
      [config.network, param(req, 'address')],
    );
    send(res, { vaults: rows });
  }));

  app.get('/vaults/:id', wrap(async (req, res) => {
    // The policy is read from the chain, never from the projection: it is the thing that decides,
    // and a stale copy of it is worse than no copy.
    const onchain = await fetchVault(client, param(req, 'id'));
    const { rows: members } = await pool.query(
      `SELECT address, roles FROM members WHERE network = $1 AND vault_id = $2 ORDER BY roles DESC`,
      [config.network, param(req, 'id')],
    );
    const { rows: assets } = await pool.query(
      `SELECT coin_type, approved, low_max, high_max, per_tx_max, daily_max, balance
         FROM assets WHERE network = $1 AND vault_id = $2 ORDER BY coin_type`,
      [config.network, param(req, 'id')],
    );
    send(res, { vault: onchain, members, assets });
  }));

  app.get('/vaults/:id/proposals', wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const status = req.query.status === undefined ? null : Number(req.query.status);
    const { rows } = await pool.query(
      `SELECT * FROM proposals
        WHERE network = $1 AND vault_id = $2 AND ($3::int IS NULL OR status = $3)
        ORDER BY proposal_id DESC LIMIT $4`,
      [config.network, param(req, 'id'), status, limit],
    );
    send(res, {
      proposals: rows.map((p) => ({
        ...p,
        amount: fromNumeric(p.amount as string),
        wait: p.status === Status.PENDING ? describeWait(new Date(p.executable_at as string).getTime()) : null,
      })),
    });
  }));

  /** The queue, from the point of view of one signer: what is waiting on them specifically. */
  app.get('/vaults/:id/queue/:address', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT p.*,
              EXISTS (SELECT 1 FROM proposal_votes v
                       WHERE v.network = p.network AND v.vault_id = p.vault_id
                         AND v.proposal_id = p.proposal_id AND v.voter = $3) AS voted,
              coalesce((SELECT m.roles FROM members m
                         WHERE m.network = p.network AND m.vault_id = p.vault_id
                           AND m.address = $3), 0) AS roles
         FROM proposals p
        WHERE p.network = $1 AND p.vault_id = $2 AND p.status = $4
        ORDER BY p.opened_at DESC`,
      [config.network, param(req, 'id'), param(req, 'address'), Status.PENDING],
    );
    send(res, {
      proposals: rows.map((p) => ({
        ...p,
        amount: fromNumeric(p.amount as string),
        needsYou:
          !p.voted &&
          ((p.kind === 0 && (Number(p.roles) & 2) !== 0) ||
            (p.kind !== 0 && (Number(p.roles) & 1) !== 0) ||
            (Number(p.req_guardians) > 0 && (Number(p.roles) & 8) !== 0)),
      })),
    });
  }));

  app.get('/vaults/:id/events', wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const { rows } = await pool.query(
      `SELECT tx_digest, event_index, name, occurred_at, payload
         FROM events WHERE network = $1 AND vault_id = $2
        ORDER BY occurred_at DESC, event_index DESC LIMIT $3`,
      [config.network, param(req, 'id'), limit],
    );
    send(res, { events: rows });
  }));

  app.get('/vaults/:id/recipients', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT address, label, trust, activates_at, paid_count, total_paid, last_paid
         FROM recipients WHERE network = $1 AND vault_id = $2 ORDER BY last_paid DESC NULLS LAST`,
      [config.network, param(req, 'id')],
    );
    send(res, {
      recipients: rows.map((r) => ({ ...r, total_paid: fromNumeric(r.total_paid as string) })),
    });
  }));

  /** The advisory a confirmation screen should show before anyone signs. */
  app.get('/vaults/:id/recipients/:address/advisory', wrap(async (req, res) => {
    send(res, await recipientAdvisory(config.network, param(req, 'id'), param(req, 'address')));
  }));

  app.get('/vaults/:id/outflow', wrap(async (req, res) => {
    const vault = await fetchVault(client, param(req, 'id'));
    send(res, { outflow: await outflow(config.network, param(req, 'id'), vault.policy) });
  }));

  app.get('/vaults/:id/risk', wrap(async (req, res) => {
    const vault = await fetchVault(client, param(req, 'id'));
    send(res, await riskReport(config.network, param(req, 'id'), vault.policy));
  }));

  /** Subscribe an address to notifications for a vault. */
  app.post('/subscriptions', wrap(async (req, res) => {
    const { vaultId, address, channel, endpoint, events, secret } = req.body ?? {};
    if (!vaultId || !address || !channel || !endpoint) {
      res.status(400);
      send(res, { error: 'vaultId, address, channel and endpoint are required' });
      return;
    }
    if (!['webhook', 'email', 'log', 'push'].includes(channel)) {
      res.status(400);
      send(res, { error: 'channel must be webhook, email, log or push' });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO subscriptions (network, vault_id, address, channel, endpoint, events, secret)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (network, vault_id, address, channel, endpoint) DO UPDATE
         SET events = EXCLUDED.events, secret = EXCLUDED.secret, active = true
       RETURNING id`,
      [config.network, vaultId, address, channel, endpoint, events ?? [], secret ?? null],
    );
    send(res, { id: rows[0].id });
  }));

  app.delete('/subscriptions/:id', wrap(async (req, res) => {
    await pool.query(`UPDATE subscriptions SET active = false WHERE id = $1`, [param(req, 'id')]);
    send(res, { ok: true });
  }));

  app.get('/subscriptions/:address/notifications', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT n.id, n.vault_id, n.rule, n.title, n.body, n.severity, n.created_at, n.delivered_at
         FROM notifications n JOIN subscriptions s ON s.id = n.subscription_id
        WHERE s.network = $1 AND s.address = $2
        ORDER BY n.created_at DESC LIMIT 100`,
      [config.network, param(req, 'address')],
    );
    send(res, { notifications: rows });
  }));

  return app;
}
