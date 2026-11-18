import { describe, expect, it } from 'vitest';
import { RandomRepository } from '../../src/repositories/random.repository';

// The pick used to be `SELECT … ORDER BY RANDOM() LIMIT 1`, which reads every row of the table —
// payload included — to sort it by a random key. On the production D1 that was 58,851 rows read per
// call, a fifth of every row the database read in the week of 2026-11-11, from 71 calls out of five
// million queries (docs/plans/random-without-table-scan/slice-01-sampled-ids.md).
//
// The probing happens inside SQLite, so the fake below does not imitate it: each test says which
// stored ids a round comes back with. Whether the SQL probes fairly is tested on real SQLite, in
// tests/integration/catalog.test.ts.

/** A seeded source, so a statistical assertion gives the same answer on every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Row = Record<string, unknown>;

/**
 * A D1 that answers the pick's two statements and throws on any other, recording each one. A round
 * answers like the real LEFT JOIN: one row per id found, in key order, or a single row with only
 * the top key when nothing was found — and with no top key at all when the table is empty.
 */
function fakeDb(options: {
  top: number | null;
  roundFinds: number[];
  rowFor: (id: number) => Row;
  emptyRow: Row;
  fallbackId?: number;
}) {
  const issued: string[] = [];
  const db = {
    prepare(sql: string) {
      issued.push(sql);
      return {
        async all() {
          if (!sql.startsWith('WITH RECURSIVE')) throw new Error(`unexpected all(): ${sql}`);
          const found = [...options.roundFinds].sort((a, b) => a - b);
          const rows = found.map((id) => ({ top: options.top, hit: id, ...options.rowFor(id) }));
          return { results: rows.length > 0 ? rows : [{ top: options.top, hit: null, ...options.emptyRow }] };
        },
        async first() {
          if (!/ORDER BY RANDOM\(\) LIMIT 1\)$/.test(sql)) throw new Error(`unexpected first(): ${sql}`);
          return options.fallbackId === undefined ? null : options.rowFor(options.fallbackId);
        },
      };
    },
  } as unknown as D1Database;
  return { db, issued };
}

const animeRow = (id: number) => ({
  payload_json: JSON.stringify({ malId: id }),
  fetched_at: '2026-11-18T00:00:00.000Z',
});
const noAnime = { payload_json: null, fetched_at: null };
const userRow = (id: number) => ({ canonical_username: `user${id}` });
const noUser = { canonical_username: null };
const malIdOf = (picked: { data: unknown } | null) => (picked?.data as { malId: number } | undefined)?.malId;

describe('RandomRepository.pick', () => {
  // One statement, not two: the Worker serving South America runs in POA and the database in ENAM,
  // so each statement is a round trip — the two-statement draft made the route ~110 ms slower.
  it('reads a round in one statement, and never sorts the table', async () => {
    const { db, issued } = fakeDb({ top: 9, roundFinds: [3, 7, 9], rowFor: animeRow, emptyRow: noAnime });

    const picked = await new RandomRepository(db, seeded(1)).pick('anime');

    expect([3, 7, 9]).toContain(malIdOf(picked));
    expect(picked?.fetchedAt).toBe('2026-11-18T00:00:00.000Z');
    expect(issued).toHaveLength(1);
    expect(issued[0]).toContain('SELECT max(mal_id) FROM anime');
    expect(issued[0]).toContain('LEFT JOIN anime AS t ON t.mal_id IN (SELECT id FROM probe)');
    expect(issued[0]).not.toMatch(/ORDER BY RANDOM\(\)/i);
  });

  // Rows come back in key order, so "take the first row found" would favour the lowest id.
  it('picks uniformly among the rows a round brings back', async () => {
    const { db } = fakeDb({ top: 64, roundFinds: [1, 2, 64], rowFor: animeRow, emptyRow: noAnime });
    const repository = new RandomRepository(db, seeded(3));
    const counts = new Map<number | undefined, number>();
    const draws = 30_000;

    for (let draw = 0; draw < draws; draw += 1) {
      const id = malIdOf(await repository.pick('anime'));
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    expect([...counts.keys()].sort()).toEqual([1, 2, 64]);
    for (const id of [1, 2, 64]) expect(Math.abs((counts.get(id) ?? 0) / draws - 1 / 3)).toBeLessThan(0.01);
  });

  it('falls back to a random sort over the key alone after three rounds that found nothing', async () => {
    const { db, issued } = fakeDb({ top: 1000, roundFinds: [], rowFor: animeRow, emptyRow: noAnime, fallbackId: 1000 });

    const picked = await new RandomRepository(db, seeded(4)).pick('characters');

    expect(malIdOf(picked)).toBe(1000);
    expect(issued).toHaveLength(4);
    expect(issued.slice(0, 3).every((sql) => sql.startsWith('WITH RECURSIVE'))).toBe(true);
    expect(issued[3]).toBe(
      'SELECT payload_json, fetched_at FROM characters WHERE mal_id = (SELECT mal_id FROM characters ORDER BY RANDOM() LIMIT 1)',
    );
  });

  it('answers null on an empty table after one statement', async () => {
    const { db, issued } = fakeDb({ top: null, roundFinds: [], rowFor: animeRow, emptyRow: noAnime });

    expect(await new RandomRepository(db, seeded(5)).pick('anime')).toBeNull();
    expect(issued).toHaveLength(1);
  });

  // D1 always returns the LEFT JOIN's row; a stub that returns nothing must not read as a database
  // full of gaps and walk through every round.
  it('reads a round that returns no row at all as an empty table', async () => {
    const issued: string[] = [];
    const db = {
      prepare: (sql: string) => {
        issued.push(sql);
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;

    expect(await new RandomRepository(db, seeded(6)).pick('manga')).toBeNull();
    expect(issued).toHaveLength(1);
  });
});

describe('RandomRepository.pickUser', () => {
  it('draws over rowid, since users are keyed by their username', async () => {
    const { db, issued } = fakeDb({ top: 3, roundFinds: [1, 2, 3], rowFor: userRow, emptyRow: noUser });

    const picked = await new RandomRepository(db, seeded(7)).pickUser();

    expect(['user1', 'user2', 'user3']).toContain(picked?.username);
    expect(issued).toHaveLength(1);
    expect(issued[0]).toContain('SELECT max(rowid) FROM users');
    expect(issued[0]).toContain('LEFT JOIN users AS t ON t.rowid IN (SELECT id FROM probe)');
  });

  it('answers null when no profile is stored', async () => {
    const { db } = fakeDb({ top: null, roundFinds: [], rowFor: userRow, emptyRow: noUser });

    expect(await new RandomRepository(db, seeded(8)).pickUser()).toBeNull();
  });
});
