CREATE TABLE interaction_events (
  id bigserial PRIMARY KEY,
  action varchar(32) NOT NULL,
  voter_hash varchar(64) NOT NULL,
  ip_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interaction_events_voter_idx ON interaction_events(action, voter_hash, created_at);
CREATE INDEX interaction_events_ip_idx ON interaction_events(action, ip_hash, created_at);
