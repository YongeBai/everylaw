-- The omitted sweep NULLs content_hash so a section that reappears in a later
-- release is always rewritten (NULL IS DISTINCT FROM any hash) and its real
-- status restored. Also aligns the live table with packages/db/src/schema.ts,
-- which already declares the column nullable.
ALTER TABLE law_nodes ALTER COLUMN content_hash DROP NOT NULL;
