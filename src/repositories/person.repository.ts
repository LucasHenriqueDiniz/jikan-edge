import type { PersonDetail } from '../domain/person';

export class PersonRepository {
  constructor(private readonly db: D1Database) {}
  async get(malId: number): Promise<PersonDetail | null> {
    const row = await this.db
      .prepare('SELECT payload_json FROM people WHERE mal_id=?')
      .bind(malId)
      .first<{ payload_json: string }>();
    return row ? (JSON.parse(row.payload_json) as PersonDetail) : null;
  }
  async put(detail: PersonDetail, fetchedAt: string, version: string): Promise<void> {
    await this.db
      .prepare(`INSERT INTO people(mal_id, name, payload_json, fetched_at, parser_version)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(mal_id) DO UPDATE SET name=excluded.name, payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, parser_version=excluded.parser_version`)
      .bind(detail.malId, detail.name, JSON.stringify(detail), fetchedAt, version)
      .run();
  }
}
