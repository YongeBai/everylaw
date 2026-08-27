ALTER TABLE law_nodes ADD COLUMN last_seen_run_id bigint;
CREATE INDEX law_nodes_last_seen_run_idx ON law_nodes(corpus_id, last_seen_run_id);
