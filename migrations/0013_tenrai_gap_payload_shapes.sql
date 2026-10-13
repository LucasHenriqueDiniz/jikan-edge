-- Shape changes from the 2026-10-11 batch, applied to rows already stored. Every parser version
-- involved was bumped, so `withCache` refetches these on the normal path. What the bump does not
-- cover is the stale fallback, which serves a stored row whatever its version when MyAnimeList is
-- unreachable (see cacheable.ts) — and an old row there would answer with the old *shape*: a string
-- where a list is now promised, or without fields the published OpenAPI document marks required.
--
-- Safe to run after the deploy, which is the order it is meant for: nothing below renames a key, so
-- rows the new code wrote in the meantime cannot collide with it. (The first draft renamed the
-- episode-list key and failed on exactly that — `UNIQUE constraint failed` — when the new
-- `:page:1` row already existed.)

-- Typed tables: rewritten in place, not deleted, for the reason 0010 gives — `/v1/random/*` draws
-- from them and would answer 404 NO_LOCAL_ENTRIES until traffic repopulated them.
--
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

-- List payloads: deleted rather than patched. Each list entry gained fields the old rows cannot
-- supply honestly — whether a season card is `continuing` depends on where it sat on the page, and a
-- dropped Filler episode is not in the old row at all — so a patched row would carry invented values.
-- These rows are cheap to rebuild (one fetch each) and `/v1/random/*` never reads them; the cost is
-- no stale fallback for them until the next request rebuilds each one.
--
-- Covered: the episode list (whose cache key also gained `:page:N`, so the old rows would be
-- orphaned anyway), season pages, anime/manga search, the review feeds, a title's reviews, a user's
-- reviews, and single-episode pages (which cached a nonexistent episode as an all-null 200).
-- cache_entries goes first, while catalog_lists still says which keys are affected.
DELETE FROM cache_entries
  WHERE resource_key LIKE 'catalog:anime:%:episodes'
     OR resource_key IN (
       SELECT resource_key FROM catalog_lists
       WHERE parser_version IN (
         'episodes-html-v2', 'episode-detail-html-v2', 'season-html-v2', 'anime-search-html-v2',
         'manga-search-html-v2', 'review-html-v2', 'title-reviews-html-v2'
       )
     );

DELETE FROM catalog_lists
  WHERE resource_key LIKE 'catalog:anime:%:episodes'
     OR parser_version IN (
       'episodes-html-v2', 'episode-detail-html-v2', 'season-html-v2', 'anime-search-html-v2',
       'manga-search-html-v2', 'review-html-v2', 'title-reviews-html-v2'
     );
