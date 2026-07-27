import { ServiceError } from './cacheable';

const TABLES = { anime: 'anime', manga: 'manga', characters: 'characters', people: 'people' } as const;
export type RandomKind = keyof typeof TABLES;

// Random draws only from entities already persisted in D1 by previous requests — MAL has no
// public "random" page, so this is a deliberate local-catalog policy (documented in docs/routes.md),
// not full-database randomness like upstream Jikan.
export class RandomService {
  constructor(private readonly db: D1Database) {}

  async pick(kind: RandomKind): Promise<unknown> {
    const row = await this.db.prepare(`SELECT payload_json FROM ${TABLES[kind]} ORDER BY RANDOM() LIMIT 1`).first<{ payload_json: string }>();
    if (!row) throw new ServiceError('NO_LOCAL_ENTRIES', 404, `No ${kind} entries cached locally yet; fetch some detail pages first.`);
    return JSON.parse(row.payload_json);
  }

  async pickUser(): Promise<{ username: string }> {
    const row = await this.db.prepare('SELECT canonical_username FROM users ORDER BY RANDOM() LIMIT 1').first<{ canonical_username: string }>();
    if (!row) throw new ServiceError('NO_LOCAL_ENTRIES', 404, 'No user profiles cached locally yet.');
    return { username: row.canonical_username };
  }
}
