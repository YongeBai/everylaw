-- Statutory defined terms, extracted from official section text
-- ("In this title, the term “X” means …"). Derived data: rebuilt wholesale by
-- `npm run ingest -- definitions`, so no updated_at bookkeeping.
--
-- scope_node_id is the ancestor node the definition reaches ("this title" →
-- the title node, "this chapter" → the chapter node, "this section"/unknown →
-- the defining section itself). A term applies to a section when its scope
-- node's level_path is an ancestor of (or equals) the section's level_path.

CREATE TABLE defined_terms (
  id bigserial PRIMARY KEY,
  corpus_id smallint NOT NULL REFERENCES corpora(id),
  node_id bigint NOT NULL REFERENCES law_nodes(id) ON DELETE CASCADE,       -- defining section
  scope_node_id bigint NOT NULL REFERENCES law_nodes(id) ON DELETE CASCADE, -- reach of the definition
  term text NOT NULL,
  definition_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX defined_terms_node_term_uq ON defined_terms(node_id, lower(term));
CREATE INDEX defined_terms_scope_idx ON defined_terms(scope_node_id);
