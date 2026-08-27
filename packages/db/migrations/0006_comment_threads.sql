-- Reddit-style discourse: takes become threadable comments with up/down votes.
ALTER TABLE takes ADD COLUMN parent_id bigint REFERENCES takes(id);
ALTER TABLE takes ADD COLUMN downvote_count integer NOT NULL DEFAULT 0;
CREATE INDEX takes_parent_idx ON takes(parent_id);

-- take_votes gains a direction: 1 = upvote, -1 = downvote. Existing rows are upvotes.
ALTER TABLE take_votes ADD COLUMN direction smallint NOT NULL DEFAULT 1 CHECK (direction IN (1, -1));

-- Direction-aware counter refresh; also fires on UPDATE so switching a vote recounts.
CREATE OR REPLACE FUNCTION refresh_take_upvotes() RETURNS trigger AS $$
DECLARE target_take bigint;
BEGIN
  target_take := COALESCE(NEW.take_id, OLD.take_id);
  UPDATE takes SET
    upvote_count = (SELECT count(*) FROM take_votes WHERE take_id = target_take AND direction = 1),
    downvote_count = (SELECT count(*) FROM take_votes WHERE take_id = target_take AND direction = -1)
  WHERE id = target_take;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS take_votes_refresh ON take_votes;
CREATE TRIGGER take_votes_refresh AFTER INSERT OR UPDATE OR DELETE ON take_votes
FOR EACH ROW EXECUTE FUNCTION refresh_take_upvotes();
