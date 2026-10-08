-- Rejections: a proposal can now be turned down by as many signers as it needed to be approved,
-- rather than only cancelled by an owner or left to expire.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS rejections INTEGER NOT NULL DEFAULT 0;

-- `proposal_votes.kind` gains a third value. The constraint is replaced rather than widened in
-- place, because Postgres has no ALTER CONSTRAINT for a CHECK.
ALTER TABLE proposal_votes DROP CONSTRAINT IF EXISTS proposal_votes_kind_check;
ALTER TABLE proposal_votes
  ADD CONSTRAINT proposal_votes_kind_check
  CHECK (kind IN ('approval', 'confirmation', 'rejection'));
