import type { PrunedBatch } from '../ports/driven/catalog-store.port';

// The oldest expired entries, through `idx_cache_entries_expiry`: the read stops at `limit`, so a
// batch never walks the table. Both deletes below select the same rows — nothing else writes
// `cache_entries` between two statements of one batch, and the index order is deterministic.
const OLDEST_EXPIRED = 'SELECT resource_key FROM cache_entries WHERE expires_at < ?1 ORDER BY expires_at LIMIT ?2';

/**
 * Removes cache entries that expired long ago, with the `catalog_lists` payload stored under the
 * same key.
 *
 * Why (2026-11-16): nothing ever deleted a cache row, and the production database had reached
 * 4.46 GB of D1's 10 GB ceiling, which cannot be raised. More than half of `cache_entries` was the
 * friends lists one scraper requested between 2026-10-19 and 2026-11-08, expired weeks before and
 * never asked for again. D1 gives the space back as soon as rows are deleted — measured on the
 * preview database: 69.8 MB of rows deleted, 1.4 MB left.
 *
 * Only `catalog_lists` loses its payload. An entry whose payload lives elsewhere — a title's
 * detail row, which `/v1/random/*` draws from, or a user's list entries — loses only its cache row:
 * the next request refetches it, and in the meantime there is simply no stale copy to fall back on
 * for something nobody asked for in the retention window.
 *
 * One `batch()`, so the two deletes commit together: a payload never outlives its cache row half a
 * batch later, and a failure removes neither.
 */
export class RetentionRepository {
  constructor(private readonly db: D1Database) {}

  async pruneExpiredBefore(cutoff: string, limit: number): Promise<PrunedBatch> {
    const [payloads, entries] = await this.db.batch([
      this.db.prepare(`DELETE FROM catalog_lists WHERE resource_key IN (${OLDEST_EXPIRED})`).bind(cutoff, limit),
      this.db.prepare(`DELETE FROM cache_entries WHERE resource_key IN (${OLDEST_EXPIRED})`).bind(cutoff, limit),
    ]);
    return {
      cacheEntries: entries.meta.changes ?? 0,
      payloads: payloads.meta.changes ?? 0,
      databaseBytes: entries.meta.size_after ?? 0,
    };
  }
}
