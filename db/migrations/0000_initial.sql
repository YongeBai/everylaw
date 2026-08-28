CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TYPE node_status AS ENUM ('active', 'repealed', 'reserved', 'omitted', 'transferred');
CREATE TYPE ai_content_type AS ENUM ('summary', 'explanation', 'origin', 'facts');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'rejected');
CREATE TYPE vote_direction AS ENUM ('keep', 'dissolve');
CREATE TYPE moderation_status AS ENUM ('pending', 'published', 'rejected');
CREATE TYPE run_status AS ENUM ('running', 'completed', 'failed');

CREATE TABLE corpora (
  id bigserial PRIMARY KEY,
  slug varchar(64) NOT NULL UNIQUE,
  name text NOT NULL,
  jurisdiction varchar(64) NOT NULL,
  source_url text NOT NULL,
  current_release varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE law_nodes (
  id bigserial PRIMARY KEY,
  corpus_id bigint NOT NULL REFERENCES corpora(id),
  parent_id bigint REFERENCES law_nodes(id),
  identifier text NOT NULL,
  node_type varchar(32) NOT NULL,
  level_path text NOT NULL,
  sort_key text NOT NULL,
  citation text NOT NULL,
  num text NOT NULL,
  heading text NOT NULL,
  status node_status NOT NULL DEFAULT 'active',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  source_credit text,
  enacting_pl varchar(64),
  enacted_date date,
  amendment_count integer NOT NULL DEFAULT 0,
  word_count integer NOT NULL DEFAULT 0,
  featured_tier integer NOT NULL DEFAULT 0 CHECK (featured_tier BETWEEN 0 AND 2),
  content_hash varchar(64) NOT NULL,
  release_point varchar(64) NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(citation, '') || ' ' || coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (corpus_id, identifier)
);
CREATE INDEX law_nodes_search_gin ON law_nodes USING gin(search_document);
CREATE INDEX law_nodes_level_path_gist ON law_nodes USING gist((level_path::ltree));
CREATE INDEX law_nodes_heading_trgm ON law_nodes USING gin(heading gin_trgm_ops);
CREATE INDEX law_nodes_parent_idx ON law_nodes(parent_id);
CREATE INDEX law_nodes_sort_idx ON law_nodes(corpus_id, sort_key);
CREATE INDEX law_nodes_tier_idx ON law_nodes(featured_tier);

CREATE TABLE ai_contents (
  id bigserial PRIMARY KEY,
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  content_type ai_content_type NOT NULL,
  body_md text NOT NULL,
  model varchar(128) NOT NULL,
  prompt_version varchar(64) NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX ai_contents_one_published_uidx ON ai_contents(node_id, content_type) WHERE status = 'published';

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE votes (
  id bigserial PRIMARY KEY,
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  voter_hash varchar(64) NOT NULL,
  ip_hash varchar(64) NOT NULL,
  user_agent_hash varchar(64) NOT NULL,
  direction vote_direction NOT NULL,
  user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(node_id, voter_hash)
);
CREATE INDEX votes_rate_voter_idx ON votes(voter_hash, updated_at);
CREATE INDEX votes_rate_ip_idx ON votes(ip_hash, updated_at);

CREATE TABLE vote_aggregates (
  node_id bigint PRIMARY KEY REFERENCES law_nodes(id),
  keep_count integer NOT NULL DEFAULT 0,
  dissolve_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  dissolve_ratio real NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION refresh_vote_aggregate() RETURNS trigger AS $$
DECLARE target_node bigint;
BEGIN
  target_node := COALESCE(NEW.node_id, OLD.node_id);
  INSERT INTO vote_aggregates(node_id, keep_count, dissolve_count, total_count, dissolve_ratio, updated_at)
  SELECT target_node,
    count(*) FILTER (WHERE direction = 'keep'),
    count(*) FILTER (WHERE direction = 'dissolve'),
    count(*),
    COALESCE(count(*) FILTER (WHERE direction = 'dissolve')::real / NULLIF(count(*), 0), 0),
    now()
  FROM votes WHERE node_id = target_node
  ON CONFLICT (node_id) DO UPDATE SET
    keep_count = EXCLUDED.keep_count,
    dissolve_count = EXCLUDED.dissolve_count,
    total_count = EXCLUDED.total_count,
    dissolve_ratio = EXCLUDED.dissolve_ratio,
    updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER votes_refresh_aggregate AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION refresh_vote_aggregate();

CREATE TABLE takes (
  id bigserial PRIMARY KEY,
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  voter_hash varchar(64) NOT NULL,
  stance vote_direction NOT NULL,
  body varchar(280) NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  upvote_count integer NOT NULL DEFAULT 0,
  moderation_status moderation_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX takes_node_stance_score_idx ON takes(node_id, stance, upvote_count DESC);
CREATE TABLE take_votes (
  take_id bigint NOT NULL REFERENCES takes(id),
  voter_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(take_id, voter_hash)
);
CREATE OR REPLACE FUNCTION refresh_take_upvotes() RETURNS trigger AS $$
DECLARE target_take bigint;
BEGIN
  target_take := COALESCE(NEW.take_id, OLD.take_id);
  UPDATE takes SET upvote_count = (SELECT count(*) FROM take_votes WHERE take_id = target_take)
  WHERE id = target_take;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER take_votes_refresh AFTER INSERT OR DELETE ON take_votes
FOR EACH ROW EXECUTE FUNCTION refresh_take_upvotes();

CREATE TABLE tags (id bigserial PRIMARY KEY, slug varchar(80) NOT NULL UNIQUE, name text NOT NULL);
CREATE TABLE node_tags (
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  tag_id bigint NOT NULL REFERENCES tags(id),
  PRIMARY KEY(node_id, tag_id)
);
CREATE TABLE ingestion_runs (
  id bigserial PRIMARY KEY,
  corpus_id bigint NOT NULL REFERENCES corpora(id),
  release_point varchar(64) NOT NULL,
  source_sha256 varchar(64),
  status run_status NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}',
  warnings jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
