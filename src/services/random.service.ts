import { ServiceError } from './cacheable';

const TABLES = { anime: 'anime', manga: 'manga', characters: 'characters', people: 'people' } as const;
export type RandomKind = keyof typeof TABLES;

// Random draws only from entities already persisted in D1 by previous requests — MAL has no
// public "random" page, so this is a deliberate local-catalog policy (documented in docs/routes.md),
// not full-database randomness like upstream Jikan.
export class RandomService {
  constructor(private readonly db: D1Database) {}

  // The row's own `fetched_at` comes back with it: this is the one read path that never refreshes,
  // so without it the caller has no way to tell a picked entity scraped an hour ago from one that
  // has been sitting in the catalog since the day it was first requested.
  async pick(kind: RandomKind): Promise<{ data: unknown; fetchedAt: string }> {
    const row = await this.db.prepare(`SELECT payload_json, fetched_at FROM ${TABLES[kind]} ORDER BY RANDOM() LIMIT 1`).first<{ payload_json: string; fetched_at: string }>();
    if (!row) throw new ServiceError('NO_LOCAL_ENTRIES', 404, `No ${kind} entries cached locally yet; fetch some detail pages first.`);
    return { data: JSON.parse(row.payload_json), fetchedAt: row.fetched_at };
  }

  async pickUser(): Promise<{ username: string }> {
    const row = await this.db.prepare('SELECT canonical_username FROM users ORDER BY RANDOM() LIMIT 1').first<{ canonical_username: string }>();
    if (!row) throw new ServiceError('NO_LOCAL_ENTRIES', 404, 'No user profiles cached locally yet.');
    return { username: row.canonical_username };
  }
}
