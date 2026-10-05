import {
  DAY,
  Mode,
  Trust,
  computeMaxLoss,
  fmtDuration,
  postureItems,
  type AssetLimits,
  type Policy,
} from '@skur/sdk';
import { fromNumeric, pool } from './db.ts';

/**
 * The off-chain policy services.
 *
 * These are advisory by design. Nothing here can approve, delay or refuse a payment — the vault
 * does that, from its own state, and a backend that could override it would be the single point of
 * failure the whole product exists to remove. What a backend can do is see across vaults and
 * across time, which no single vault object can, and tell a human something useful before they
 * sign.
 */

export type RecipientAdvisory = {
  address: string;
  /** Trust as the vault records it. */
  trust: Trust;
  knownForMs: number;
  paymentsFromThisVault: number;
  /** How many other vaults on this network have paid it. */
  otherVaults: number;
  /** How many vaults have restricted or blocked it. */
  restrictedBy: number;
  flags: string[];
  /** Short sentence for a confirmation screen. */
  summary: string;
};

export async function recipientAdvisory(
  network: string,
  vaultId: string,
  address: string,
): Promise<RecipientAdvisory> {
  const { rows: local } = await pool.query<{
    trust: number;
    paid_count: number;
    first_seen: Date;
    activates_at: Date | null;
  }>(
    `SELECT trust, paid_count, first_seen, activates_at
       FROM recipients WHERE network = $1 AND vault_id = $2 AND address = $3`,
    [network, vaultId, address],
  );
  const { rows: rep } = await pool.query<{
    vault_count: number;
    payment_count: number;
    first_seen: Date;
    blocked_by: number;
  }>(
    `SELECT vault_count, payment_count, first_seen, blocked_by
       FROM recipient_reputation WHERE network = $1 AND address = $2`,
    [network, address],
  );

  const r = local[0];
  const g = rep[0];
  const now = Date.now();
  const knownForMs = r ? now - r.first_seen.getTime() : g ? now - g.first_seen.getTime() : 0;
  const trust = (r?.trust ?? Trust.UNKNOWN) as Trust;
  const paymentsFromThisVault = r?.paid_count ?? 0;
  const otherVaults = Math.max((g?.vault_count ?? 0) - (paymentsFromThisVault > 0 ? 1 : 0), 0);
  const restrictedBy = g?.blocked_by ?? 0;

  const flags: string[] = [];
  if (trust === Trust.UNKNOWN) flags.push('This vault has never paid this address.');
  if (trust === Trust.BLOCKED) flags.push('This address is blocked by this vault.');
  if (trust === Trust.RESTRICTED) flags.push('This address is restricted by this vault.');
  if (r?.activates_at && r.activates_at.getTime() > now) {
    flags.push(`Still activating, for another ${fmtDuration(r.activates_at.getTime() - now)}.`);
  }
  if (restrictedBy > 0) {
    flags.push(
      `${restrictedBy} vault${restrictedBy === 1 ? '' : 's'} on this network have restricted or blocked it.`,
    );
  }
  if (knownForMs > 0 && knownForMs < DAY) flags.push('First seen less than a day ago.');
  if (paymentsFromThisVault === 0 && otherVaults > 0) {
    flags.push(`Paid by ${otherVaults} other vault${otherVaults === 1 ? '' : 's'}, but not by this one.`);
  }

  const summary = flags.length
    ? flags[0]
    : paymentsFromThisVault > 0
      ? `Paid ${paymentsFromThisVault} time${paymentsFromThisVault === 1 ? '' : 's'} before, first seen ${fmtDuration(knownForMs)} ago.`
      : 'Nothing known about this address.';

  return {
    address,
    trust,
    knownForMs,
    paymentsFromThisVault,
    otherVaults,
    restrictedBy,
    flags,
    summary,
  };
}

/**
 * Outflow against the envelope, from the indexed history rather than the chain, so a dashboard
 * can show the trend without a round trip per asset.
 */
export type OutflowWindow = {
  coinType: string;
  spentInWindow: bigint;
  envelopeLimit: bigint;
  /** 0 to 10,000. */
  usedBps: number;
  dailyCap: bigint;
  spentToday: bigint;
};

export async function outflow(
  network: string,
  vaultId: string,
  policy: Policy,
): Promise<OutflowWindow[]> {
  const windowStart = new Date(Date.now() - (policy.envelopeWindow || DAY));
  const dayStart = new Date(Date.now() - DAY);
  const { rows } = await pool.query<{
    coin_type: string;
    balance: string;
    daily_max: string;
    in_window: string | null;
    today: string | null;
  }>(
    `SELECT a.coin_type,
            a.balance,
            a.daily_max,
            (SELECT sum(p.amount) FROM proposals p
              WHERE p.network = a.network AND p.vault_id = a.vault_id
                AND p.coin_type = a.coin_type AND p.status = 2 AND p.settled_at >= $3) AS in_window,
            (SELECT sum(p.amount) FROM proposals p
              WHERE p.network = a.network AND p.vault_id = a.vault_id
                AND p.coin_type = a.coin_type AND p.status = 2 AND p.settled_at >= $4) AS today
       FROM assets a
      WHERE a.network = $1 AND a.vault_id = $2 AND a.approved`,
    [network, vaultId, windowStart, dayStart],
  );

  return rows.map((row) => {
    const balance = fromNumeric(row.balance);
    const spent = fromNumeric(row.in_window);
    // Measured against the balance plus what already left, which approximates the basis the
    // contract pinned when the window opened. The contract's own number is authoritative.
    const basis = balance + spent;
    const limit = policy.envelopeBps === 0 ? 0n : (basis * BigInt(policy.envelopeBps)) / 10_000n;
    return {
      coinType: row.coin_type,
      spentInWindow: spent,
      envelopeLimit: limit,
      usedBps: limit === 0n ? 0 : Number((spent * 10_000n) / limit),
      dailyCap: fromNumeric(row.daily_max),
      spentToday: fromNumeric(row.today),
    };
  });
}

/** The posture report and the maximum-loss numbers, computed from indexed state. */
export async function riskReport(network: string, vaultId: string, policy: Policy) {
  const { rows } = await pool.query<{
    coin_type: string;
    approved: boolean;
    low_max: string;
    high_max: string;
    per_tx_max: string;
    daily_max: string;
    balance: string;
  }>(
    `SELECT coin_type, approved, low_max, high_max, per_tx_max, daily_max, balance
       FROM assets WHERE network = $1 AND vault_id = $2`,
    [network, vaultId],
  );
  const { rows: vrows } = await pool.query<{ mode: number; guardians: string }>(
    `SELECT v.mode,
            (SELECT count(*) FROM members m
              WHERE m.network = v.network AND m.vault_id = v.vault_id AND (m.roles & 8) <> 0) AS guardians
       FROM vaults v WHERE v.network = $1 AND v.vault_id = $2`,
    [network, vaultId],
  );
  const mode = (vrows[0]?.mode ?? Mode.NORMAL) as Mode;
  const guardians = Number(vrows[0]?.guardians ?? 0);

  const assets = rows.map((r) => ({
    coinType: r.coin_type,
    limits: {
      approved: r.approved,
      lowMax: fromNumeric(r.low_max),
      highMax: fromNumeric(r.high_max),
      perTxMax: fromNumeric(r.per_tx_max),
      dailyMax: fromNumeric(r.daily_max),
    } satisfies AssetLimits,
    balance: fromNumeric(r.balance),
  }));

  return {
    posture: postureItems({
      policy,
      guardians,
      assets: assets.map((a) => ({ symbol: a.coinType, limits: a.limits })),
    }),
    maxLoss: assets.map((a) => ({
      coinType: a.coinType,
      ...computeMaxLoss(policy, a.limits, a.balance, mode),
    })),
  };
}
