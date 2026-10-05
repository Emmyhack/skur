import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  KIND_LABELS,
  MODE_LABELS,
  Kind,
  Mode,
  Role,
  STATUS_LABELS,
  Status,
  TIER_LABELS,
  Tier,
  Trust,
  describeReasons,
  fmtDuration,
  short,
  type DecodedEvent,
} from '@skur/sdk';
import { pool } from './db.ts';

/**
 * Who needs to be told, and why.
 *
 * The rule is the point of the whole service: an approver should hear about the queue, an
 * executor about what is ready, and a guardian about the things only a guardian can stop. Sending
 * everything to everyone is the same as sending nothing, because nobody reads the eleventh alert.
 *
 * `roles` is a bitmask of who the message is for; zero means every member of the vault.
 */
type Rule = {
  rule: string;
  title: string;
  body: string;
  severity: 'info' | 'action' | 'alert';
  roles: number;
};

const fmtAmount = (v: bigint) => v.toLocaleString('en-US');

export function rulesFor({ event }: DecodedEvent): Rule[] {
  switch (event.name) {
    case 'ProposalOpened': {
      const out: Rule[] = [];
      const who = event.kind === Kind.TRANSFER ? Role.APPROVER : Role.OWNER;
      const label = KIND_LABELS[event.kind] ?? 'Proposal';

      if (event.kind === Kind.TRANSFER) {
        const reasons = describeReasons(event.reasons);
        out.push({
          rule: 'transfer.opened',
          title: `${TIER_LABELS[event.tier]} payment awaiting approval`,
          body: [
            `${fmtAmount(event.amount)} to ${short(event.recipient)}${event.memo ? ` — ${event.memo}` : ''}.`,
            `Needs ${event.reqApprovals} approval${event.reqApprovals === 1 ? '' : 's'}${
              event.reqGuardians ? ` and ${event.reqGuardians} guardian confirmation${event.reqGuardians === 1 ? '' : 's'}` : ''
            }.`,
            reasons.length ? `Scored ${TIER_LABELS[event.tier]} because: ${reasons.join('; ')}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          severity: 'action',
          roles: who,
        });
        if (event.tier === Tier.CRITICAL) {
          out.push({
            rule: 'transfer.critical',
            title: 'A critical payment is open and can be vetoed',
            body: `${fmtAmount(event.amount)} to ${short(event.recipient)}, at ${(event.exposureBps / 100).toFixed(1)}% of holdings. You can veto it until it executes.`,
            severity: 'alert',
            roles: Role.GUARDIAN,
          });
        }
      } else {
        out.push({
          rule: 'governance.opened',
          title: `${label} awaiting owner approval`,
          body: `Opened by ${short(event.proposer)}.`,
          severity: 'action',
          roles: who,
        });
      }

      // The one notification that matters most: somebody is trying to make the vault weaker.
      if (event.reductionMask !== 0) {
        out.push({
          rule: 'governance.weakening',
          title: `${label} would weaken this vault`,
          body: `It cannot take effect before ${new Date(event.executableAt).toUTCString()}, and any guardian can veto it until then.`,
          severity: 'alert',
          roles: Role.GUARDIAN | Role.OWNER,
        });
      }
      if (event.kind === Kind.RECOVERY) {
        out.push({
          rule: 'recovery.opened',
          title: 'A signer recovery has been proposed',
          body: `Proposed by ${short(event.proposer)}. Any owner can cancel it before it executes.`,
          severity: 'alert',
          roles: Role.OWNER,
        });
      }
      return out;
    }

    case 'Approved':
      // Only the approval that completes the set is worth an interruption.
      if (event.approvals < event.reqApprovals) return [];
      return [
        {
          rule: 'proposal.ready',
          title: 'A payment has all its approvals',
          body: `Proposal #${event.proposal} is fully approved. It executes once its waiting period has elapsed.`,
          severity: 'action',
          roles: Role.EXECUTOR,
        },
      ];

    case 'BreakerTripped':
      return [
        {
          rule: 'breaker.tripped',
          title: 'The circuit breaker stopped a payment and froze the vault',
          body: `${fmtAmount(event.amount)} would have taken the window past its loss envelope of ${fmtAmount(event.envelopeLimit)} against a basis of ${fmtAmount(event.envelopeBasis)}. The money did not move. The vault is now in Lockdown and needs owners, a guardian and time to reopen.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'ModeChanged':
      if (event.to === Mode.NORMAL) {
        return [
          {
            rule: 'mode.normal',
            title: 'The vault is back to normal',
            body: `Lowered from ${MODE_LABELS[event.from]} by ${short(event.actor)}.`,
            severity: 'info',
            roles: 0,
          },
        ];
      }
      return [
        {
          rule: 'mode.raised',
          title: `The vault is now in ${MODE_LABELS[event.to]}`,
          body: [
            `Raised from ${MODE_LABELS[event.from]} by ${short(event.actor)}.`,
            event.to === Mode.LOCKDOWN
              ? 'Nothing outgoing executes until owners and a guardian agree to reopen it.'
              : 'Caps are halved and every payment is escalated one tier.',
            describeReasons(event.reasons).join('; '),
          ]
            .filter(Boolean)
            .join(' '),
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'Settled':
      if (event.status === Status.VETOED) {
        return [
          {
            rule: 'proposal.vetoed',
            title: 'A guardian vetoed a proposal',
            body: `Proposal #${event.proposal} was vetoed by ${short(event.actor)}. The vault moved to Elevated.`,
            severity: 'alert',
            roles: 0,
          },
        ];
      }
      if (event.status === Status.EXPIRED) {
        return [
          {
            rule: 'proposal.expired',
            title: 'A proposal expired before it executed',
            body: `Proposal #${event.proposal} (${KIND_LABELS[event.kind]}) ran out of time. Its approvals no longer count for anything.`,
            severity: 'info',
            roles: Role.APPROVER | Role.OWNER,
          },
        ];
      }
      return [];

    case 'Executed':
      if (event.kind !== Kind.TRANSFER) return [];
      return [
        {
          rule: 'transfer.executed',
          title: 'A payment went out',
          body: `${fmtAmount(event.amount)} to ${short(event.recipient)}, executed by ${short(event.executor)}. ${fmtAmount(event.balanceAfter)} remains.`,
          severity: 'info',
          roles: 0,
        },
      ];

    case 'RecipientTrustChanged':
      if (event.to !== Trust.BLOCKED && event.to !== Trust.RESTRICTED) return [];
      return [
        {
          rule: 'recipient.restricted',
          title: `A recipient was ${event.to === Trust.BLOCKED ? 'blocked' : 'restricted'}`,
          body: `${short(event.recipient)} was set by ${short(event.actor)}. Payments to it are ${event.to === Trust.BLOCKED ? 'refused' : 'treated as critical'} from now on.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'Recovered':
      return [
        {
          rule: 'recovery.executed',
          title: 'A signer was replaced',
          body: `${short(event.lost)} was replaced by ${short(event.replacement)} with the same roles. The policy was not changed, and the vault is now Elevated.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'PolicyChanged':
      return [
        {
          rule: 'policy.changed',
          title: `The policy is now at version ${event.version}`,
          body: event.reductionMask === 0
            ? 'The change only tightened the vault.'
            : 'The change gave up one or more controls. It served its delay and was not vetoed.',
          severity: event.reductionMask === 0 ? 'info' : 'alert',
          roles: 0,
        },
      ];

    default:
      return [];
  }
}

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

export { STATUS_LABELS };
