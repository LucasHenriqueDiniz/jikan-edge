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

// Ids read per round. D1 allows 100 bound parameters per query. At the density measured in
// production on 2026-11-18 (36–51% of ids below the top one are stored) a round of 32 finds nothing
// less than once in a million draws.
const PROBES = 32;
// Rounds before the fallback. Only a table that is nearly all gaps gets past the first.
const ATTEMPTS = 3;
// Cap on draws per round: the ids are drawn without repeats, and a loop bounded by successes alone
// would spin forever on a source that keeps repeating itself.
const MAX_DRAWS = PROBES * 8;

type KeyColumn = 'mal_id' | 'rowid';

export class RandomRepository {
  constructor(
    private readonly db: D1Database,
    private readonly random: () => number = Math.random,
  ) {}

  // The row's own `fetched_at` comes back with it: this is the one read path that never refreshes,
  // so without it the caller has no way to tell a picked entity scraped an hour ago from one that
  // has been sitting in the catalog since the day it was first requested.
  //
  // Answers `null` on an empty table rather than throwing. Deciding that an empty local catalog is
  // a 404 with the code `NO_LOCAL_ENTRIES` is policy, and policy stayed in `RandomService`.
  async pick(kind: RandomKind): Promise<{ data: unknown; fetchedAt: string } | null> {
    const row = await this.sample<{ payload_json: string; fetched_at: string }>(
      TABLES[kind],
      'mal_id',
      'payload_json, fetched_at',
    );
    return row ? { data: JSON.parse(row.payload_json), fetchedAt: row.fetched_at } : null;
  }

  // `users` is keyed by the username, so the draw runs over the implicit rowid. Its rowids stay
  // dense: a profile refresh is an upsert (`ON CONFLICT DO UPDATE` keeps the rowid) and nothing
  // deletes a user row.
  async pickUser(): Promise<{ username: string } | null> {
    const row = await this.sample<{ canonical_username: string }>('users', 'rowid', 'canonical_username');
    return row ? { username: row.canonical_username } : null;
  }

  /**
   * A uniformly random stored row, found by key instead of by sorting the table.
   *
   * `ORDER BY RANDOM()` reads every row, payload included, to sort them by a random key. Here the
   * top key is one index lookup, and each round reads at most `PROBES` rows by key. Every stored
   * key is equally likely to be probed and, once found, equally likely to be chosen, so the pick is
   * uniform over what is stored — `WHERE key >= <random> LIMIT 1` would instead favour a key that
   * sits after a long gap.
   *
   * After `ATTEMPTS` empty rounds the table is mostly gaps, which makes it small: 96 probes all miss
   * one time in twenty when 3% of the ids below the top one are stored, and one in a million at 13%.
   * On a table that sparse the old random sort is cheap — at most a few thousand rows under MAL's
   * id range — so it runs, over the key alone, and the row is then read by key.
   * The first draft fell back to the first key at or after a random point instead, which is one row
   * but biased — on the preview D1 (61 anime spread over 64,809 ids) it drew one id in four out of
   * six picks. A freshly self-hosted catalog looks like that.
   */
  private async sample<Row>(table: string, key: KeyColumn, columns: string): Promise<Row | null> {
    const top = await this.db.prepare(`SELECT max(${key}) AS top FROM ${table}`).first<{ top: number | null }>();
    const max = top?.top ?? null;
    if (max === null) return null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const ids = this.probes(max);
      const { results } = await this.db
        .prepare(`SELECT ${columns} FROM ${table} WHERE ${key} IN (${ids.map(() => '?').join(', ')})`)
        .bind(...ids)
        .all<Row>();
      if (results.length > 0) return results[Math.floor(this.random() * results.length)] ?? null;
    }
    return this.db
      .prepare(`SELECT ${columns} FROM ${table} WHERE ${key} = (SELECT ${key} FROM ${table} ORDER BY RANDOM() LIMIT 1)`)
      .first<Row>();
  }

  // A table no larger than one round is probed whole, so it never misses.
  private probes(max: number): number[] {
    if (max <= PROBES) return Array.from({ length: max }, (_, index) => index + 1);
    const ids = new Set<number>();
    for (let draw = 0; ids.size < PROBES && draw < MAX_DRAWS; draw += 1) ids.add(this.idUpTo(max));
    return [...ids];
  }

  private idUpTo(max: number): number {
    return 1 + Math.floor(this.random() * max);
  }
}
