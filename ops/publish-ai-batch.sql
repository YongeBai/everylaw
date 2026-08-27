-- Publish the newest Claude-generated draft per (node, content_type), demoting
-- any previously published row first. NOTE: these must be two sequential
-- statements — a single data-modifying CTE executes its sub-statements without
-- ordering guarantees, and the partial unique index
-- ai_contents_one_published_uidx then sees the old published row. Idempotent;
-- run after human spot-review of drafts.
BEGIN;

UPDATE ai_contents a SET status = 'rejected', reviewed_at = now()
WHERE a.status = 'published' AND EXISTS (
  SELECT 1 FROM ai_contents d
  WHERE d.status = 'draft' AND d.model LIKE 'claude%'
    AND d.node_id = a.node_id AND d.content_type = a.content_type);

UPDATE ai_contents a SET status = 'published', reviewed_at = now()
FROM (
  SELECT DISTINCT ON (node_id, content_type) id
  FROM ai_contents
  WHERE status = 'draft' AND model LIKE 'claude%'
  ORDER BY node_id, content_type, id DESC
) newest
WHERE a.id = newest.id;

COMMIT;
SELECT content_type, status, count(*) FROM ai_contents GROUP BY 1, 2 ORDER BY 1, 2;
