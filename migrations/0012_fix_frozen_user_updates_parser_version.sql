-- UpdatesRepository.put() ignored the version argument every other repository accepts, writing the
-- literal 'user-html-v1:updates' on every insert and never touching parser_version on conflict — so
-- the column froze at that literal on first write and never tracked the real parser version used.
-- This never broke live serving: withCache compares cache_entries.parser_version, not this column,
-- and cache_entries was written correctly all along. But it left this table's own bookkeeping
-- column lying, which is exactly the kind of drift a future targeted migration (like 0009 or 0010)
-- would trust. Backfill it from cache_entries, the table that has always been right.
UPDATE user_updates
SET parser_version = (
  SELECT parser_version FROM cache_entries WHERE cache_entries.resource_key = 'user:' || user_updates.username_key || ':updates'
)
WHERE EXISTS (
  SELECT 1 FROM cache_entries WHERE cache_entries.resource_key = 'user:' || user_updates.username_key || ':updates'
);
