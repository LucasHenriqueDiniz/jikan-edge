import type { ClubDetail } from '../domain/club';

export class ClubRepository {
  constructor(private readonly db: D1Database) {}
  async get(malId: number): Promise<ClubDetail | null> {
    const row = await this.db
      .prepare('SELECT payload_json FROM clubs WHERE mal_id=?')
      .bind(malId)
      .first<{ payload_json: string }>();
    return row ? (JSON.parse(row.payload_json) as ClubDetail) : null;
  }
  async put(detail: ClubDetail, fetchedAt: string, version: string): Promise<void> {
    await this.db
      .prepare(`INSERT INTO clubs(mal_id, title, payload_json, fetched_at, parser_version)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(mal_id) DO UPDATE SET title=excluded.title, payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, parser_version=excluded.parser_version`)
      .bind(detail.malId, detail.title, JSON.stringify(detail), fetchedAt, version)
      .run();
  }
}
