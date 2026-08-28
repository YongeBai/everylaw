-- Ledger of daily docket trials. A row is written the first time a day's
-- docket renders (recording which section stood trial), and the verdict
-- snapshot (keep/dissolve at close) is filled in lazily by the first docket
-- render after the day rolls over. Closed rows drive permanent verdict flair
-- on the section wherever it appears.
CREATE TABLE trials (
  day_key date PRIMARY KEY,
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  keep_count integer,
  dissolve_count integer,
  closed_at timestamptz
);
CREATE INDEX trials_node_idx ON trials(node_id, day_key DESC);
