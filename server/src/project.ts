import type { PoolClient } from 'pg';
import { Status, type DecodedEvent, type SkurEvent } from '@skur/sdk';
import { toNumeric, toTimestamp } from './db.ts';

/**
 * Apply one event to the projections.
 *
 * Every statement is an upsert keyed on the chain's own identity for the row, so replaying the
 * ledger converges on the same state rather than doubling anything. The one place that needs care
 * is a counter: `paid_count` and `total_paid` are accumulated, so they are only ever touched from
 * inside the idempotency guard in `ingest`, which has already established that this exact event
 * has not been applied before.
 */
export async function project(
  c: PoolClient,
  network: string,
  { event, position }: DecodedEvent,
): Promise<void> {
  const at = toTimestamp(event.at);
  const vault = event.vault;
  const key = [network, vault];

  switch (event.name) {
    case 'VaultCreated':
      await c.query(
        `INSERT INTO vaults (network, vault_id, name, creator, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (network, vault_id) DO UPDATE
           SET name = EXCLUDED.name, creator = EXCLUDED.creator`,
        [...key, event.vaultName, event.creator, at],
      );
      break;

    case 'Deposited':
      await c.query(
        `INSERT INTO assets (network, vault_id, coin_type, balance, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (network, vault_id, coin_type) DO UPDATE
           SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at`,
        [...key, event.asset, toNumeric(event.balance), at],
      );
      break;

    case 'ProposalOpened':
      await c.query(
        `INSERT INTO proposals (
           network, vault_id, proposal_id, kind, status, proposer, coin_type, amount, recipient,
           memo, tier, reasons, exposure_bps, req_approvals, req_guardians, reduction_mask,
           opened_at, executable_at, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (network, vault_id, proposal_id) DO UPDATE SET
           kind = EXCLUDED.kind, status = EXCLUDED.status, proposer = EXCLUDED.proposer,
           coin_type = EXCLUDED.coin_type, amount = EXCLUDED.amount,
           recipient = EXCLUDED.recipient, memo = EXCLUDED.memo, tier = EXCLUDED.tier,
           reasons = EXCLUDED.reasons, exposure_bps = EXCLUDED.exposure_bps,
           req_approvals = EXCLUDED.req_approvals, req_guardians = EXCLUDED.req_guardians,
           reduction_mask = EXCLUDED.reduction_mask, opened_at = EXCLUDED.opened_at,
           executable_at = EXCLUDED.executable_at, expires_at = EXCLUDED.expires_at`,
        [
          ...key,
          event.proposal.toString(),
          event.kind,
          Status.PENDING,
          event.proposer,
          event.asset,
          toNumeric(event.amount),
          event.recipient === '0x0000000000000000000000000000000000000000000000000000000000000000'
            ? null
            : event.recipient,
          event.memo,
          event.tier,
          event.reasons,
          event.exposureBps,
          event.reqApprovals,
          event.reqGuardians,
          event.reductionMask,
          at,
          toTimestamp(event.executableAt),
          toTimestamp(event.expiresAt),
        ],
      );
      break;

    case 'Approved':
      await c.query(
        `INSERT INTO proposal_votes (network, vault_id, proposal_id, voter, kind, voted_at)
         VALUES ($1,$2,$3,$4,'approval',$5)
         ON CONFLICT DO NOTHING`,
        [...key, event.proposal.toString(), event.approver, at],
      );
      await c.query(
        `UPDATE proposals SET approvals = $4
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), event.approvals],
      );
      break;

    case 'Rejected':
      await c.query(
        `INSERT INTO proposal_votes (network, vault_id, proposal_id, voter, kind, voted_at)
         VALUES ($1,$2,$3,$4,'rejection',$5)
         ON CONFLICT DO NOTHING`,
        [...key, event.proposal.toString(), event.rejecter, at],
      );
      await c.query(
        `UPDATE proposals SET rejections = $4
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), event.rejections],
      );
      break;

    case 'Confirmed':
      await c.query(
        `INSERT INTO proposal_votes (network, vault_id, proposal_id, voter, kind, voted_at)
         VALUES ($1,$2,$3,$4,'confirmation',$5)
         ON CONFLICT DO NOTHING`,
        [...key, event.proposal.toString(), event.guardian, at],
      );
      await c.query(
        `UPDATE proposals SET confirmations = $4
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), event.confirmations],
      );
      break;

    case 'Settled':
      await c.query(
        `UPDATE proposals SET status = $4, settled_at = $5
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), event.status, at],
      );
      break;

    case 'Executed': {
      await c.query(
        `UPDATE proposals SET status = $4, settled_at = $5, tier = $6
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), Status.EXECUTED, at, event.tier],
      );
      if (event.asset) {
        await c.query(
          `INSERT INTO assets (network, vault_id, coin_type, balance, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (network, vault_id, coin_type) DO UPDATE
             SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at`,
          [...key, event.asset, toNumeric(event.balanceAfter), at],
        );
      }
      if (event.recipient) {
        await c.query(
          `INSERT INTO recipients (network, vault_id, address, paid_count, total_paid, first_seen, last_paid)
           VALUES ($1,$2,$3,1,$4,$5,$5)
           ON CONFLICT (network, vault_id, address) DO UPDATE SET
             paid_count = recipients.paid_count + 1,
             total_paid = recipients.total_paid + EXCLUDED.total_paid,
             last_paid = EXCLUDED.last_paid`,
          [...key, event.recipient, toNumeric(event.amount), at],
        );
        await c.query(
          `INSERT INTO recipient_reputation (network, address, vault_count, payment_count, first_seen, last_seen)
           VALUES ($1,$2,1,1,$3,$3)
           ON CONFLICT (network, address) DO UPDATE SET
             payment_count = recipient_reputation.payment_count + 1,
             last_seen = EXCLUDED.last_seen,
             vault_count = (
               SELECT count(DISTINCT vault_id) FROM recipients
               WHERE network = $1 AND address = $2 AND paid_count > 0
             )`,
          [network, event.recipient, at],
        );
      }
      break;
    }

    case 'BreakerTripped':
      await c.query(
        `UPDATE proposals SET status = $4, settled_at = $5
         WHERE network = $1 AND vault_id = $2 AND proposal_id = $3`,
        [...key, event.proposal.toString(), Status.BLOCKED, at],
      );
      break;

    case 'ModeChanged':
      await c.query(
        `UPDATE vaults SET mode = $3, posture_reasons = $4, updated_at = $5
         WHERE network = $1 AND vault_id = $2`,
        [...key, event.to, event.reasons, at],
      );
      break;

    case 'PolicyChanged':
      await c.query(
        `UPDATE vaults SET policy_version = $3, updated_at = $4
         WHERE network = $1 AND vault_id = $2`,
        [...key, event.version.toString(), at],
      );
      break;

    case 'LimitsChanged':
      await c.query(
        `INSERT INTO assets (
           network, vault_id, coin_type, approved, low_max, high_max, per_tx_max, daily_max, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (network, vault_id, coin_type) DO UPDATE SET
           approved = EXCLUDED.approved, low_max = EXCLUDED.low_max,
           high_max = EXCLUDED.high_max, per_tx_max = EXCLUDED.per_tx_max,
           daily_max = EXCLUDED.daily_max, updated_at = EXCLUDED.updated_at`,
        [
          ...key,
          event.asset,
          event.approved,
          toNumeric(event.lowMax),
          toNumeric(event.highMax),
          toNumeric(event.perTxMax),
          toNumeric(event.dailyMax),
          at,
        ],
      );
      break;

    case 'MemberChanged':
      if (event.rolesAfter === 0) {
        await c.query(
          `DELETE FROM members WHERE network = $1 AND vault_id = $2 AND address = $3`,
          [...key, event.member],
        );
      } else {
        await c.query(
          `INSERT INTO members (network, vault_id, address, roles, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (network, vault_id, address) DO UPDATE
             SET roles = EXCLUDED.roles, updated_at = EXCLUDED.updated_at`,
          [...key, event.member, event.rolesAfter, at],
        );
      }
      break;

    case 'RecipientRegistered':
      await c.query(
        `INSERT INTO recipients (network, vault_id, address, label, trust, activates_at, first_seen)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (network, vault_id, address) DO UPDATE SET
           label = EXCLUDED.label, trust = EXCLUDED.trust, activates_at = EXCLUDED.activates_at`,
        [...key, event.recipient, event.label, event.trust, toTimestamp(event.activatesAt), at],
      );
      break;

    case 'RecipientTrustChanged':
      await c.query(
        `INSERT INTO recipients (network, vault_id, address, trust, first_seen)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (network, vault_id, address) DO UPDATE SET trust = EXCLUDED.trust`,
        [...key, event.recipient, event.to, at],
      );
      // A blocked destination is the strongest signal the system produces about an address, so it
      // is counted across vaults even though no contract reads it.
      await c.query(
        `INSERT INTO recipient_reputation (network, address, first_seen, last_seen, blocked_by)
         VALUES ($1,$2,$3,$3,$4)
         ON CONFLICT (network, address) DO UPDATE SET
           last_seen = EXCLUDED.last_seen,
           blocked_by = (
             SELECT count(*) FROM recipients
             WHERE network = $1 AND address = $2 AND trust IN (4, 5)
           )`,
        [network, event.recipient, at, event.to >= 4 ? 1 : 0],
      );
      break;

    case 'Recovered':
      await c.query(
        `DELETE FROM members WHERE network = $1 AND vault_id = $2 AND address = $3`,
        [...key, event.lost],
      );
      await c.query(
        `INSERT INTO members (network, vault_id, address, roles, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (network, vault_id, address) DO UPDATE
           SET roles = EXCLUDED.roles, updated_at = EXCLUDED.updated_at`,
        [...key, event.replacement, event.roles, at],
      );
      break;
  }

  await c.query(
    `INSERT INTO events (network, tx_digest, event_index, vault_id, name, checkpoint, occurred_at, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (network, tx_digest, event_index) DO NOTHING`,
    [
      network,
      position.transactionDigest,
      position.eventIndex,
      vault,
      event.name,
      position.checkpoint ?? null,
      at,
      JSON.stringify(event, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ],
  );
}

/** A `VaultCreated` row may be missing if indexing started mid-history; make one so FKs hold. */
export async function ensureVault(c: PoolClient, network: string, event: SkurEvent) {
  await c.query(
    `INSERT INTO vaults (network, vault_id, name, creator, created_at)
     VALUES ($1,$2,'(discovered)','0x0',$3)
     ON CONFLICT (network, vault_id) DO NOTHING`,
    [network, event.vault, toTimestamp(event.at)],
  );
}
