-- Publish the newest Claude-generated draft per (node, content_type), demoting
-- any previously published row first (ai_contents_one_published_uidx allows one
-- published row per pair). Idempotent; run after human spot-review of drafts.
BEGIN;
WITH newest AS (
  SELECT DISTINCT ON (node_id, content_type) id, node_id, content_type
  FROM ai_contents
  WHERE status = 'draft' AND model LIKE 'claude%'
  ORDER BY node_id, content_type, id DESC
), demoted AS (
  UPDATE ai_contents a SET status = 'rejected', reviewed_at = now()
  FROM newest n
  WHERE a.status = 'published' AND a.node_id = n.node_id AND a.content_type = n.content_type
  RETURNING a.id
)
UPDATE ai_contents a SET status = 'published', reviewed_at = now()
FROM newest n WHERE a.id = n.id;
COMMIT;
SELECT content_type, status, count(*) FROM ai_contents GROUP BY 1, 2 ORDER BY 1, 2;
