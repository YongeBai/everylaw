-- Daily ELO rank snapshot: powers the leaderboard movement arrows.
-- Run once a day (cron/GitHub Action):
--   docker compose exec -T postgres psql -U everylaw -d everylaw < ops/snapshot-elo.sql
INSERT INTO elo_snapshots (node_id, snapped_on, rank, elo)
SELECT node_id, current_date, rank() OVER (ORDER BY elo DESC), elo
FROM elo_ratings
WHERE matches > 0
ON CONFLICT (node_id, snapped_on) DO UPDATE SET rank = EXCLUDED.rank, elo = EXCLUDED.elo;
