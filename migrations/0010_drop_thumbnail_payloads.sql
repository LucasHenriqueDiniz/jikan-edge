-- Every `*_PARSER_VERSION` was bumped alongside this migration, so `withCache` already refuses the
-- stored snapshots and refetches them. What the bump does NOT cover is the stale fallback
-- (`cacheable.ts:24` and `:33`): when the refresh lease is taken, or when MyAnimeList is
-- unavailable, the old payload is served anyway with `meta.stale: true`. For the six hours of a TTL
-- cycle that path would keep publishing the 50x70 CDN stamp this release exists to remove.
--
-- Deleting is the right tool rather than `json_remove`: the change is to the *value* of imageUrl
-- across a whole list, not the presence of a key, and SQLite has no clean way to rewrite every URL
-- inside a JSON array in place. The next request rebuilds the row from the source page.
--
-- The LIKE guard keeps this from touching rows that were already clean (a list of magazines or
-- season years carries no image at all).
DELETE FROM catalog_lists WHERE payload_json LIKE '%cdn.myanimelist.net/r/%';

-- The six typed tables (anime, manga, characters, people, clubs, producers) are deliberately NOT
-- cleared. Their detail pages already served the full-size cover — only the synopsis changes, and
-- a synopsis without paragraph breaks is a degraded value, not a wrong one, so it is not worth the
-- cost: `/v1/random/*` draws its entries from exactly these tables and would answer
-- `404 NO_LOCAL_ENTRIES` until traffic repopulated them. The version bump refreshes them on the
-- normal path anyway.

-- `user_favorites` and `user_updates` hold avatars and cover art from the profile page, and both
-- were missed by 0009. Same reasoning as catalog_lists: bump plus stale fallback leaves thumbnails
-- reachable, and these rows are cheap to rebuild (one profile fetch each).
DELETE FROM user_favorites WHERE payload_json LIKE '%cdn.myanimelist.net/r/%';
DELETE FROM user_updates WHERE payload_json LIKE '%cdn.myanimelist.net/r/%';
