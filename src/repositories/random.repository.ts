import type { RandomKind } from '../domain/random';

// The kind → table map is SQL, so it belongs here rather than in the service that used to hold it.
// It is also the reason the interpolation below is safe: `RandomKind` is a closed union, the lookup
// can only produce one of these four literals, and no caller-supplied string reaches the statement.
const TABLES: Record<RandomKind, string> = {
  anime: 'anime',
  manga: 'manga',
  characters: 'characters',
  people: 'people',
};

export class RandomRepository {
  constructor(private readonly db: D1Database) {}

  // The row's own `fetched_at` comes back with it: this is the one read path that never refreshes,
  // so without it the caller has no way to tell a picked entity scraped an hour ago from one that
  // has been sitting in the catalog since the day it was first requested.
  //
  // Answers `null` on an empty table rather than throwing. Deciding that an empty local catalog is
  // a 404 with the code `NO_LOCAL_ENTRIES` is policy, and policy stayed in `RandomService`.
  async pick(kind: RandomKind): Promise<{ data: unknown; fetchedAt: string } | null> {
    const row = await this.db
      .prepare(`SELECT payload_json, fetched_at FROM ${TABLES[kind]} ORDER BY RANDOM() LIMIT 1`)
      .first<{ payload_json: string; fetched_at: string }>();
    return row ? { data: JSON.parse(row.payload_json), fetchedAt: row.fetched_at } : null;
  }

  async pickUser(): Promise<{ username: string } | null> {
    const row = await this.db
      .prepare('SELECT canonical_username FROM users ORDER BY RANDOM() LIMIT 1')
      .first<{ canonical_username: string }>();
    return row ? { username: row.canonical_username } : null;
  }
}
