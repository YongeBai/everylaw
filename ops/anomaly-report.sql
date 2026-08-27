-- Nightly monitoring query. Review clusters before excluding them from public totals.
WITH clusters AS (
  SELECT
    v.node_id,
    v.ip_hash,
    count(*) AS cluster_votes,
    max(a.total_count) AS total_votes,
    min(v.created_at) AS first_vote,
    max(v.updated_at) AS last_vote
  FROM votes v
  JOIN vote_aggregates a ON a.node_id = v.node_id
  WHERE v.updated_at > now() - interval '24 hours'
  GROUP BY v.node_id, v.ip_hash
)
SELECT
  n.citation,
  n.heading,
  clusters.*,
  round(100.0 * cluster_votes / nullif(total_votes, 0), 1) AS percent_from_ip
FROM clusters
JOIN law_nodes n ON n.id = clusters.node_id
WHERE cluster_votes >= 5
  AND cluster_votes::numeric / nullif(total_votes, 0) > 0.40
ORDER BY percent_from_ip DESC, cluster_votes DESC;
