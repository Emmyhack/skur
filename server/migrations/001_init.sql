-- Skur indexer and notification store.
--
-- Nothing here is authoritative. The chain is. Every row is a projection of an event the vault
-- emitted, kept so that an interface can answer "show me the last 500 payments" without walking
-- the ledger, and so that a notification can be sent once rather than every time someone polls.
--
-- Two consequences are designed for: the indexer may see the same event twice (so every insert is
-- idempotent on its ledger position), and it may be rebuilt from zero (so no table holds state
-- that cannot be derived from events).

CREATE TABLE IF NOT EXISTS networks (
  name          TEXT PRIMARY KEY,
  package_id    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Where the indexer has read to. One row per network, advanced only after a batch commits.
CREATE TABLE IF NOT EXISTS indexer_cursor (
  network       TEXT PRIMARY KEY REFERENCES networks(name) ON DELETE CASCADE,
  cursor        TEXT,
  last_event_at TIMESTAMPTZ,
  events_seen   BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vaults (
  network         TEXT NOT NULL REFERENCES networks(name) ON DELETE CASCADE,
  vault_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  creator         TEXT NOT NULL,
  mode            SMALLINT NOT NULL DEFAULT 0,
  posture_reasons INTEGER NOT NULL DEFAULT 0,
  policy_version  BIGINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network, vault_id)
);

-- The raw event log, which is the only table the projections are derived from.
CREATE TABLE IF NOT EXISTS events (
  network      TEXT NOT NULL REFERENCES networks(name) ON DELETE CASCADE,
  tx_digest    TEXT NOT NULL,
  event_index  INTEGER NOT NULL,
  vault_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  checkpoint   BIGINT,
  occurred_at  TIMESTAMPTZ NOT NULL,
  payload      JSONB NOT NULL,
  PRIMARY KEY (network, tx_digest, event_index)
);

CREATE INDEX IF NOT EXISTS events_vault_time ON events (network, vault_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_name ON events (network, name, occurred_at DESC);

CREATE TABLE IF NOT EXISTS members (
  network    TEXT NOT NULL,
  vault_id   TEXT NOT NULL,
  address    TEXT NOT NULL,
  roles      SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network, vault_id, address)
);

CREATE INDEX IF NOT EXISTS members_by_address ON members (network, address);

CREATE TABLE IF NOT EXISTS assets (
  network     TEXT NOT NULL,
  vault_id    TEXT NOT NULL,
  coin_type   TEXT NOT NULL,
  approved    BOOLEAN NOT NULL DEFAULT false,
  low_max     NUMERIC(39,0) NOT NULL DEFAULT 0,
  high_max    NUMERIC(39,0) NOT NULL DEFAULT 0,
  per_tx_max  NUMERIC(39,0) NOT NULL DEFAULT 0,
  daily_max   NUMERIC(39,0) NOT NULL DEFAULT 0,
  balance     NUMERIC(39,0) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network, vault_id, coin_type)
);

CREATE TABLE IF NOT EXISTS proposals (
  network        TEXT NOT NULL,
  vault_id       TEXT NOT NULL,
  proposal_id    BIGINT NOT NULL,
  kind           SMALLINT NOT NULL,
  status         SMALLINT NOT NULL,
  proposer       TEXT NOT NULL,
  coin_type      TEXT,
  amount         NUMERIC(39,0) NOT NULL DEFAULT 0,
  recipient      TEXT,
  memo           TEXT NOT NULL DEFAULT '',
  tier           SMALLINT NOT NULL DEFAULT 0,
  reasons        INTEGER NOT NULL DEFAULT 0,
  exposure_bps   INTEGER NOT NULL DEFAULT 0,
  req_approvals  SMALLINT NOT NULL DEFAULT 0,
  req_guardians  SMALLINT NOT NULL DEFAULT 0,
  approvals      INTEGER NOT NULL DEFAULT 0,
  confirmations  INTEGER NOT NULL DEFAULT 0,
  reduction_mask INTEGER NOT NULL DEFAULT 0,
  opened_at      TIMESTAMPTZ NOT NULL,
  executable_at  TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  settled_at     TIMESTAMPTZ,
  PRIMARY KEY (network, vault_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS proposals_pending ON proposals (network, vault_id, status, executable_at);
CREATE INDEX IF NOT EXISTS proposals_recipient ON proposals (network, recipient) WHERE recipient IS NOT NULL;

CREATE TABLE IF NOT EXISTS proposal_votes (
  network     TEXT NOT NULL,
  vault_id    TEXT NOT NULL,
  proposal_id BIGINT NOT NULL,
  voter       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('approval', 'confirmation')),
  voted_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (network, vault_id, proposal_id, voter, kind)
);

CREATE TABLE IF NOT EXISTS recipients (
  network       TEXT NOT NULL,
  vault_id      TEXT NOT NULL,
  address       TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  trust         SMALLINT NOT NULL DEFAULT 0,
  activates_at  TIMESTAMPTZ,
  paid_count    INTEGER NOT NULL DEFAULT 0,
  total_paid    NUMERIC(39,0) NOT NULL DEFAULT 0,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_paid     TIMESTAMPTZ,
  PRIMARY KEY (network, vault_id, address)
);

-- Cross-vault reputation: how many distinct vaults have paid this address, and for how long.
-- This is the one genuinely off-chain signal, and it is advisory only. No contract reads it.
CREATE TABLE IF NOT EXISTS recipient_reputation (
  network       TEXT NOT NULL,
  address       TEXT NOT NULL,
  vault_count   INTEGER NOT NULL DEFAULT 0,
  payment_count INTEGER NOT NULL DEFAULT 0,
  first_seen    TIMESTAMPTZ NOT NULL,
  last_seen     TIMESTAMPTZ NOT NULL,
  blocked_by    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (network, address)
);

-- Who gets told what. A subscription is per address and per vault, because a guardian wants the
-- vetoable things and an approver wants the queue.
CREATE TABLE IF NOT EXISTS subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  network     TEXT NOT NULL,
  vault_id    TEXT NOT NULL,
  address     TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('webhook', 'email', 'log')),
  endpoint    TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT '{}',
  secret      TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network, vault_id, address, channel, endpoint)
);

CREATE TABLE IF NOT EXISTS notifications (
  id              BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  network         TEXT NOT NULL,
  vault_id        TEXT NOT NULL,
  -- The event that caused it, so a replayed event cannot send a second notification.
  tx_digest       TEXT NOT NULL,
  event_index     INTEGER NOT NULL,
  rule            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'action', 'alert')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMPTZ,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  UNIQUE (subscription_id, tx_digest, event_index, rule)
);

CREATE INDEX IF NOT EXISTS notifications_undelivered
  ON notifications (created_at) WHERE delivered_at IS NULL;
