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

// Keys probed per round. At the density measured in production on 2026-11-18 (36–51% of the ids
// below the top one are stored) a round of 32 finds nothing less than once in a million draws.
const PROBES = 32;
// Rounds before the fallback. Only a table that is nearly all gaps gets past the first.
const ATTEMPTS = 3;
// `random()` is a signed 64-bit integer. Masking the sign bit keeps the modulo uniform; `abs()` would
// throw on the one value it cannot negate.
const NON_NEGATIVE = '9223372036854775807';

type KeyColumn = 'mal_id' | 'rowid';
type RoundRow = { top: number | null; hit: number | null };

/**
 * One round, in one statement: the top key, `PROBES` random keys below it, and the rows stored under
 * them. Done in SQL rather than as `max()` and then an `IN` list because each statement is a round
 * trip, and the Worker serving South America runs in POA while the database runs in ENAM: the
 * two-statement version (3aa8f15) made the route ~110 ms slower than the sort it replaced.
 *
 * The LEFT JOIN always yields a row — `top` null on an empty table, `hit` null when no probe matched
 * — so one statement tells the three cases apart. A table no larger than one round is probed whole.
 * Measured on a 58,500-row copy in the preview D1: 164 rows read, under 1 ms of SQL, the `max()` an
 * index search and every probe a rowid lookup.
 */
function roundSql(table: string, key: KeyColumn, columns: string[]): string {
  const draw = `1 + (random() & ${NON_NEGATIVE}) % top`;
  return [
    'WITH RECURSIVE',
    `bound(top) AS (SELECT max(${key}) FROM ${table}),`,
    `probe(n, id) AS (SELECT 1, CASE WHEN top <= ${PROBES} THEN 1 ELSE ${draw} END FROM bound WHERE top IS NOT NULL`,
    `UNION ALL SELECT n + 1, CASE WHEN top <= ${PROBES} THEN n + 1 ELSE ${draw} END FROM probe, bound WHERE n < min(top, ${PROBES}))`,
    `SELECT bound.top AS top, t.${key} AS hit, ${columns.map((column) => `t.${column}`).join(', ')}`,
    `FROM bound LEFT JOIN ${table} AS t ON t.${key} IN (SELECT id FROM probe)`,
  ].join(' ');
}

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
    const row = await this.sample<{ payload_json: string; fetched_at: string }>(TABLES[kind], 'mal_id', [
      'payload_json',
      'fetched_at',
    ]);
    return row ? { data: JSON.parse(row.payload_json), fetchedAt: row.fetched_at } : null;
  }

  // `users` is keyed by the username, so the draw runs over the implicit rowid. Its rowids stay
  // dense: a profile refresh is an upsert (`ON CONFLICT DO UPDATE` keeps the rowid) and nothing
  // deletes a user row.
  async pickUser(): Promise<{ username: string } | null> {
    const row = await this.sample<{ canonical_username: string }>('users', 'rowid', ['canonical_username']);
    return row ? { username: row.canonical_username } : null;
  }

  /**
   * A uniformly random stored row, found by key instead of by sorting the table.
   *
   * `ORDER BY RANDOM()` reads every row, payload included, to sort them by a random key. A round
   * reads at most `PROBES` rows by key. Every stored key is equally likely to be probed and, once
   * found, equally likely to be chosen, so the pick is uniform over what is stored — `WHERE key >=
   * <random> LIMIT 1` would instead favour a key that sits after a long gap.
   *
   * After `ATTEMPTS` empty rounds the table is mostly gaps, which makes it small: 32 probes all miss
   * three rounds running one time in twenty when 3% of the ids below the top one are stored, and one
   * in a million at 13%. On a table that sparse the old random sort is cheap — at most a few thousand
   * rows under MAL's id range — so it runs, over the key alone, and the row is then read by key. The
   * first draft fell back to the first key at or after a random point instead: one row, but on the
   * preview D1 (61 anime spread over 64,809 ids) it drew the same anime 4 times in the first 6 picks.
   * A freshly self-hosted catalog looks like that.
   */
  private async sample<Row>(table: string, key: KeyColumn, columns: string[]): Promise<Row | null> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const { results } = await this.db.prepare(roundSql(table, key, columns)).all<Row & RoundRow>();
      if ((results[0]?.top ?? null) === null) return null;
      const found = results.filter((row) => row.hit !== null);
      if (found.length > 0) return found[Math.floor(this.random() * found.length)] ?? null;
    }
    return this.db
      .prepare(
        `SELECT ${columns.join(', ')} FROM ${table} WHERE ${key} = (SELECT ${key} FROM ${table} ORDER BY RANDOM() LIMIT 1)`,
      )
      .first<Row>();
  }
}
