import type { Favorites } from '../parsers/user-favorites.parser';
export class FavoritesRepository {
  constructor(private readonly db: D1Database) {}
  async get(key: string): Promise<Favorites | null> { const row = await this.db.prepare('SELECT payload_json FROM user_favorites WHERE username_key=?').bind(key).first<{ payload_json: string }>(); return row ? JSON.parse(row.payload_json) as Favorites : null; }
  async put(key: string, value: Favorites, fetchedAt: string, version: string): Promise<void> { await this.db.prepare('INSERT INTO user_favorites(username_key,payload_json,fetched_at,parser_version) VALUES(?,?,?,?) ON CONFLICT(username_key) DO UPDATE SET payload_json=excluded.payload_json,fetched_at=excluded.fetched_at,parser_version=excluded.parser_version').bind(key, JSON.stringify(value), fetchedAt, version).run(); }
}
