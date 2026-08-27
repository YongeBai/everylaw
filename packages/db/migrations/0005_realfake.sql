-- "Can't Make It Up": real-or-fake law guessing game.

CREATE TABLE decoys (
  id smallserial PRIMARY KEY,
  citation varchar(64) NOT NULL UNIQUE,   -- plausible but non-existent citation
  heading text NOT NULL
);

CREATE TABLE guesses (
  id bigserial PRIMARY KEY,
  item_kind varchar(8) NOT NULL CHECK (item_kind IN ('law', 'decoy')),
  item_id bigint NOT NULL,
  voter_hash varchar(64) NOT NULL,
  ip_hash varchar(64) NOT NULL,
  guessed_real boolean NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guesses_item_idx ON guesses(item_kind, item_id);
CREATE INDEX guesses_voter_idx ON guesses(voter_hash, created_at);
