import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import { fmtDuration, type DecodedEvent } from '@skur/sdk';
import { pool } from './db.ts';
import { rulesFor } from './rules.ts';

/**
 * Queue notifications for an event. The unique constraint on
 * `(subscription, tx_digest, event_index, rule)` is what makes a replayed event silent.
 */
export async function queueNotifications(
  c: PoolClient,
  network: string,
  decoded: DecodedEvent,
): Promise<number> {
  const rules = rulesFor(decoded);
  if (rules.length === 0) return 0;
  const { event, position } = decoded;
  let queued = 0;

  for (const r of rules) {
    const { rows } = await c.query<{ id: string }>(
      `SELECT s.id
         FROM subscriptions s
         LEFT JOIN members m
           ON m.network = s.network AND m.vault_id = s.vault_id AND m.address = s.address
        WHERE s.active
          AND s.network = $1
          AND s.vault_id = $2
          AND ($3 = 0 OR (coalesce(m.roles, 0) & $3) <> 0)
          AND (cardinality(s.events) = 0 OR $4 = ANY(s.events))`,
      [network, event.vault, r.roles, r.rule],
    );
    for (const row of rows) {
      const res = await c.query(
        `INSERT INTO notifications (
           subscription_id, network, vault_id, tx_digest, event_index, rule, title, body, severity
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [
          row.id,
          network,
          event.vault,
          position.transactionDigest,
          position.eventIndex,
          r.rule,
          r.title,
          r.body,
          r.severity,
        ],
      );
      queued += res.rowCount ?? 0;
    }
  }
  return queued;
}

/**
 * Deliver what is queued. A webhook is signed with the subscription's secret so the receiver can
 * tell a real notification from anything else that finds the URL.
 */
export async function deliverPending(limit = 25): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    channel: string;
    endpoint: string;
    secret: string | null;
    vault_id: string;
    rule: string;
    title: string;
    body: string;
    severity: string;
    attempts: number;
  }>(
    `SELECT n.id, s.channel, s.endpoint, s.secret, n.vault_id, n.rule, n.title, n.body,
            n.severity, n.attempts
       FROM notifications n
       JOIN subscriptions s ON s.id = n.subscription_id
      WHERE n.delivered_at IS NULL AND n.attempts < 6 AND s.active
      ORDER BY n.created_at
      LIMIT $1`,
    [limit],
  );

  let sent = 0;
  for (const n of rows) {
    const payload = JSON.stringify({
      vault: n.vault_id,
      rule: n.rule,
      title: n.title,
      body: n.body,
      severity: n.severity,
    });
    try {
      if (n.channel === 'webhook') {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (n.secret) {
          headers['x-skur-signature'] = createHmac('sha256', n.secret).update(payload).digest('hex');
        }
        const res = await fetch(n.endpoint, { method: 'POST', headers, body: payload });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      } else if (n.channel === 'log') {
        console.log(`[${n.severity}] ${n.title} — ${n.body}`);
      } else {
        // Email needs a provider. Rather than pretend, the row is left for whoever wires one up.
        throw new Error(`channel ${n.channel} has no transport configured`);
      }
      await pool.query(
        `UPDATE notifications SET delivered_at = now(), attempts = attempts + 1 WHERE id = $1`,
        [n.id],
      );
      sent++;
    } catch (e) {
      await pool.query(
        `UPDATE notifications SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
        [n.id, e instanceof Error ? e.message : String(e)],
      );
    }
  }
  return sent;
}

/** Used by the API to describe a waiting proposal in words rather than timestamps. */
export function describeWait(executableAt: number, now = Date.now()): string {
  const left = executableAt - now;
  if (left <= 0) return 'executable now';
  return `executable in ${fmtDuration(left)}`;
}


