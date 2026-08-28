-- Drop tables orphaned by the deletion of the old-design engagement pages:
-- /rate head-to-head matchups + ELO leaderboard (0004_elo) and the
-- "Can't Make It Up" real-or-fake game (0005_realfake). Also removes the
-- never-populated accounts scaffolding (users table + votes.user_id, both
-- with zero rows/values everywhere); if account claiming ships later it
-- re-adds them in a fresh migration.
DROP TABLE IF EXISTS guesses;
DROP TABLE IF EXISTS decoys;
DROP TABLE IF EXISTS matchup_votes;
DROP TABLE IF EXISTS elo_snapshots;
DROP TABLE IF EXISTS elo_ratings;
ALTER TABLE votes DROP COLUMN IF EXISTS user_id;
DROP TABLE IF EXISTS users;
