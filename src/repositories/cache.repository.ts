export interface CacheEntry {
  resourceKey: string;
  expiresAt: string;
  fetchedAt: string;
  sourceStatus: string;
  parserVersion: string;
}

export class CacheRepository {
  constructor(private readonly db: D1Database) {}

  async get(resourceKey: string): Promise<CacheEntry | null> {
    const row = await this.db.prepare('SELECT resource_key, expires_at, fetched_at, source_status, parser_version FROM cache_entries WHERE resource_key = ?').bind(resourceKey).first<Record<string, string>>();
    return row ? { resourceKey: row.resource_key, expiresAt: row.expires_at, fetchedAt: row.fetched_at, sourceStatus: row.source_status, parserVersion: row.parser_version } : null;
  }

  async put(entry: CacheEntry): Promise<void> {
    await this.db.prepare(`INSERT INTO cache_entries(resource_key, expires_at, fetched_at, source_status, parser_version)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(resource_key) DO UPDATE SET expires_at=excluded.expires_at, fetched_at=excluded.fetched_at, source_status=excluded.source_status, parser_version=excluded.parser_version`)
      .bind(entry.resourceKey, entry.expiresAt, entry.fetchedAt, entry.sourceStatus, entry.parserVersion).run();
  }

  isFresh(entry: CacheEntry, now = new Date()): boolean { return Date.parse(entry.expiresAt) > now.getTime(); }
}
