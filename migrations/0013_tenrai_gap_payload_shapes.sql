-- Shape changes from the 2026-10-11 batch, applied to rows already stored. Every parser version
-- involved was bumped, so `withCache` refetches these on the normal path. What the bump does not
-- cover is the stale fallback, which serves a stored row whatever its version when MyAnimeList is
-- unreachable (see cacheable.ts) — and an old row there would answer with the old *shape*.
--
-- Rewritten in place rather than deleted, for the reason 0010 gives: `/v1/random/*` draws from the
-- typed tables, and emptying them answers 404 NO_LOCAL_ENTRIES until traffic repopulates them.

-- `alternateNames` went from one comma-joined string to a list. SQLite has no split, so a stored
-- string becomes a one-element list: the right shape with a degraded value, which the next refresh
-- replaces with the real list. `birthDate` is new and starts null. The person `full` documents in
-- catalog_lists carry the same fields at the top level.
UPDATE people SET payload_json = json_set(
    payload_json,
    '$.alternateNames',
    CASE WHEN json_type(payload_json, '$.alternateNames') = 'text'
         THEN json_array(json_extract(payload_json, '$.alternateNames'))
         ELSE json('[]') END,
    '$.birthDate',
    NULL)
  WHERE json_type(payload_json, '$.alternateNames') IS NOT 'array';

UPDATE catalog_lists SET payload_json = json_set(
    payload_json,
    '$.alternateNames',
    CASE WHEN json_type(payload_json, '$.alternateNames') = 'text'
         THEN json_array(json_extract(payload_json, '$.alternateNames'))
         ELSE json('[]') END,
    '$.birthDate',
    NULL)
  WHERE resource_key LIKE 'catalog:person:%:full'
    AND json_type(payload_json, '$.alternateNames') IS NOT 'array';

-- `nicknames` is new on characters. Absent, a stale row would answer without the key at all.
UPDATE characters SET payload_json = json_set(payload_json, '$.nicknames', json('[]'))
  WHERE json_type(payload_json, '$.nicknames') IS NULL;

UPDATE catalog_lists SET payload_json = json_set(payload_json, '$.nicknames', json('[]'))
  WHERE resource_key LIKE 'catalog:character:%:full'
    AND json_type(payload_json, '$.nicknames') IS NULL;

-- The episode list paginates now, and its cache key gained the `:page:N` suffix every other
-- paginated route already carries. Renamed rather than dropped, as 0011 did for reviews, so the
-- stale fallback survives the change. Both tables move together: catalog_lists holds the payload
-- and cache_entries the freshness metadata, keyed by the same string.
UPDATE catalog_lists SET resource_key = resource_key || ':page:1'
  WHERE resource_key LIKE 'catalog:anime:%:episodes';

UPDATE cache_entries SET resource_key = resource_key || ':page:1'
  WHERE resource_key LIKE 'catalog:anime:%:episodes';
