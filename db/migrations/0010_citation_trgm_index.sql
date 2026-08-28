-- Search's WHERE is an OR of three matchers; the citation ILIKE arm had no
-- index, which forced the whole OR into a seq scan over every law_node
-- (~450ms on production). With all three arms index-backed Postgres BitmapOrs
-- them instead (~12ms).
CREATE INDEX law_nodes_citation_trgm ON law_nodes USING gin(citation gin_trgm_ops);
