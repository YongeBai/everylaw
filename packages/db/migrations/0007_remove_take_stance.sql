-- A comment's side is now derived from the commenter's live vote on the law
-- (votes.direction joined via voter_hash), so the stored stance goes away.
DROP INDEX IF EXISTS takes_node_stance_score_idx;
ALTER TABLE takes DROP COLUMN IF EXISTS stance;
CREATE INDEX IF NOT EXISTS takes_node_score_idx ON takes(node_id, upvote_count DESC);
