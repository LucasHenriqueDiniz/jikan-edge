export class CatalogListRepository {
  constructor(private readonly db: D1Database) {}
  async get<T>(resourceKey: string): Promise<T | null> {
    const row = await this.db.prepare('SELECT payload_json FROM catalog_lists WHERE resource_key=?').bind(resourceKey).first<{ payload_json: string }>();
    return row ? JSON.parse(row.payload_json) as T : null;
  }
  async put<T>(resourceKey: string, payload: T, fetchedAt: string, version: string): Promise<void> {
    await this.db.prepare(`INSERT INTO catalog_lists(resource_key, payload_json, fetched_at, parser_version)
      VALUES (?, ?, ?, ?) ON CONFLICT(resource_key) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, parser_version=excluded.parser_version`)
      .bind(resourceKey, JSON.stringify(payload), fetchedAt, version).run();
  }
}
