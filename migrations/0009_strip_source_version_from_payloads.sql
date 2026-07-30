-- Rows written before `sourceVersion` was dropped from the domain still carry the internal
-- cache-invalidation token inside their stored payload, so cached responses keep publishing it
-- until each row happens to be refetched. Nothing reads it: `parser_version` is a column on every
-- one of these tables and is what `withCache` compares. Strip it in place instead of waiting a
-- full TTL cycle. `json_remove` is a no-op for rows that never had the key, and the LIKE guard
-- keeps the statements from rewriting rows that are already clean.
UPDATE anime SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';
UPDATE manga SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';
UPDATE characters SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';
UPDATE people SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';
UPDATE clubs SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';
UPDATE producers SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';

-- catalog_lists holds `:full` and `:statistics` documents, which are single objects that carried the
-- field at the top level exactly like the detail tables. The list-shaped rows never had it, and the
-- LIKE guard skips them.
UPDATE catalog_lists SET payload_json = json_remove(payload_json, '$.sourceVersion') WHERE payload_json LIKE '%"sourceVersion"%';

-- The two genre rows are a different problem: their payload is the old truncated sidebar taxonomy
-- (12-13 entries) in the old shape, kept only as a stale fallback. Drop them so the first request
-- rebuilds them from the search page source.
DELETE FROM catalog_lists WHERE resource_key IN ('catalog:genres:anime', 'catalog:genres:manga');
