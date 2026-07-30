-- `reviews` and `recommendations` gave the first page a cache key without the `:page:1` suffix,
-- while every other paginated route in the codebase always suffixes. The services now suffix too,
-- which would leave these four rows unreadable forever: never hit again, never expired, never
-- cleaned up. Renaming keeps the stale fallback working across the change instead of dropping the
-- safety net for a cosmetic fix.
--
-- Both tables have to move together: `catalog_lists` holds the payload and `cache_entries` holds
-- the freshness metadata `withCache` reads, keyed by the same string.
UPDATE catalog_lists SET resource_key = resource_key || ':page:1'
  WHERE resource_key IN ('catalog:reviews:anime', 'catalog:reviews:manga',
                         'catalog:recommendations:anime', 'catalog:recommendations:manga');

UPDATE cache_entries SET resource_key = resource_key || ':page:1'
  WHERE resource_key IN ('catalog:reviews:anime', 'catalog:reviews:manga',
                         'catalog:recommendations:anime', 'catalog:recommendations:manga');
