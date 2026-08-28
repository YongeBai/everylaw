-- Head-to-head matchup voting ("Which law would you keep?") + per-law ELO.

CREATE TABLE matchup_votes (
  id bigserial PRIMARY KEY,
  winner_node_id bigint NOT NULL REFERENCES law_nodes(id),
  loser_node_id bigint NOT NULL REFERENCES law_nodes(id),
  voter_hash varchar(64) NOT NULL,
  ip_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (winner_node_id <> loser_node_id)
);
CREATE INDEX matchup_votes_pair_idx ON matchup_votes(winner_node_id, loser_node_id);
CREATE INDEX matchup_votes_voter_idx ON matchup_votes(voter_hash, created_at);
CREATE INDEX matchup_votes_ip_idx ON matchup_votes(ip_hash, created_at);

CREATE TABLE elo_ratings (
  node_id bigint PRIMARY KEY REFERENCES law_nodes(id),
  elo real NOT NULL DEFAULT 1500,
  matches integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX elo_ratings_elo_idx ON elo_ratings(elo DESC);

-- Daily rank snapshots power the leaderboard movement arrows.
CREATE TABLE elo_snapshots (
  node_id bigint NOT NULL REFERENCES law_nodes(id),
  snapped_on date NOT NULL,
  rank integer NOT NULL,
  elo real NOT NULL,
  PRIMARY KEY (node_id, snapped_on)
);
CREATE INDEX elo_snapshots_day_idx ON elo_snapshots(snapped_on);
