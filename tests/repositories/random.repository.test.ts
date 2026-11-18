import { describe, expect, it } from 'vitest';
import { RandomRepository } from '../../src/repositories/random.repository';

// The pick used to be `SELECT … ORDER BY RANDOM() LIMIT 1`, which reads every row of the table —
// payload included — to sort it by a random key. On the production D1 that was 58,851 rows read per
// call, a fifth of every row the database read in the week of 2026-11-11, from 71 calls out of five
// million queries (docs/plans/random-without-table-scan/slice-01-sampled-ids.md).

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

type Issued = { sql: string; params: unknown[] };

/**
 * An in-memory table that answers the statements the pick is allowed to issue and throws on any
 * other, recording each one with what it was bound to.
 */
function fakeTable(ids: number[], rowFor: (id: number) => Record<string, unknown>) {
  const issued: Issued[] = [];
  const stored = new Set(ids);
  const sorted = [...ids].sort((a, b) => a - b);
  const db = {
    prepare(sql: string) {
      const entry: Issued = { sql, params: [] };
      issued.push(entry);
      const statement = {
        bind(...values: unknown[]) {
          entry.params = values;
          return statement;
        },
        async first() {
          if (/^SELECT max\(/.test(sql)) return { top: sorted.at(-1) ?? null };
          if (/ = \(SELECT \w+ FROM \w+ ORDER BY RANDOM\(\) LIMIT 1\)$/.test(sql)) {
            const id = sorted[Math.floor(Math.random() * sorted.length)];
            return id === undefined ? null : rowFor(id);
          }
          throw new Error(`unexpected first(): ${sql}`);
        },
        // In key order, whatever the order of the list: that is how D1 answered an IN lookup on
        // production (2026-11-18), and it is what makes "take the first row found" a biased pick.
        async all() {
          if (!/ IN \(/.test(sql)) throw new Error(`unexpected all(): ${sql}`);
          return {
            results: entry.params
              .map(Number)
              .filter((id) => stored.has(id))
              .sort((a, b) => a - b)
              .map(rowFor),
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db, issued };
}

const animeRow = (id: number) => ({
  payload_json: JSON.stringify({ malId: id }),
  fetched_at: '2026-11-18T00:00:00.000Z',
});
const userRow = (id: number) => ({ canonical_username: `user${id}` });
const malIdOf = (picked: { data: unknown } | null) => (picked?.data as { malId: number } | undefined)?.malId;

describe('RandomRepository.pick', () => {
  it('reads by key — the top id, then one IN list — and never sorts the table', async () => {
    const { db, issued } = fakeTable([3, 7, 9], animeRow);

    const picked = await new RandomRepository(db, seeded(1)).pick('anime');

    expect([3, 7, 9]).toContain(malIdOf(picked));
    expect(picked?.fetchedAt).toBe('2026-11-18T00:00:00.000Z');
    expect(issued.map((entry) => entry.sql)).toEqual([
      'SELECT max(mal_id) AS top FROM anime',
      expect.stringMatching(/^SELECT payload_json, fetched_at FROM anime WHERE mal_id IN \(\?(, \?)*\)$/),
    ]);
    expect(issued.some((entry) => /RANDOM\(\)/i.test(entry.sql))).toBe(false);
  });

  it('binds at most 32 distinct ids however large the table is', async () => {
    const { db, issued } = fakeTable(
      Array.from({ length: 50_000 }, (_, index) => index * 2 + 1),
      animeRow,
    );

    await new RandomRepository(db, seeded(2)).pick('manga');

    const probes = issued[1].params;
    expect(probes).toHaveLength(32);
    expect(new Set(probes).size).toBe(32);
    for (const id of probes) expect(id).toBeGreaterThanOrEqual(1);
    for (const id of probes) expect(id).toBeLessThanOrEqual(99_999);
  });

  // The cheap alternative, `WHERE mal_id >= <random> LIMIT 1`, picks an id with the probability of
  // the gap in front of it: over these three ids it lands on 64 about 97% of the time.
  it('is uniform over the stored ids, whatever the gaps between them', async () => {
    const { db } = fakeTable([1, 2, 64], animeRow);
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

  it('probes every id of a table no larger than one round, so it never misses there', async () => {
    const { db, issued } = fakeTable([32], animeRow);

    const picked = await new RandomRepository(db, () => 0).pick('people');

    expect(malIdOf(picked)).toBe(32);
    expect(issued).toHaveLength(2);
    expect(issued[1].params).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
  });

  it('falls back to a random sort over the key alone after three rounds that found nothing', async () => {
    // Probes stay in 1..900, so they never reach the one stored id.
    const below900 = seeded(4);
    const { db, issued } = fakeTable([1000], animeRow);

    const picked = await new RandomRepository(db, () => below900() * 0.9).pick('characters');

    expect(malIdOf(picked)).toBe(1000);
    expect(issued.map((entry) => entry.sql)).toEqual([
      'SELECT max(mal_id) AS top FROM characters',
      expect.stringContaining(' IN ('),
      expect.stringContaining(' IN ('),
      expect.stringContaining(' IN ('),
      'SELECT payload_json, fetched_at FROM characters WHERE mal_id = (SELECT mal_id FROM characters ORDER BY RANDOM() LIMIT 1)',
    ]);
  });

  // The draw loop rejects repeated ids. Bounded by successes alone, a source that keeps repeating
  // itself would spin forever inside a request.
  it('does not hang on a random source that repeats itself', async () => {
    const { db, issued } = fakeTable([1, 500, 1000], animeRow);

    const picked = await new RandomRepository(db, () => 0).pick('anime');

    expect(malIdOf(picked)).toBe(1);
    expect(issued[1].params).toEqual([1]);
  });

  it('answers null on an empty table after one statement', async () => {
    const { db, issued } = fakeTable([], animeRow);

    expect(await new RandomRepository(db, seeded(5)).pick('anime')).toBeNull();
    expect(issued).toHaveLength(1);
  });
});

describe('RandomRepository.pickUser', () => {
  it('draws over rowid, since users are keyed by their username', async () => {
    const { db, issued } = fakeTable([1, 2, 3], userRow);

    const picked = await new RandomRepository(db, seeded(6)).pickUser();

    expect(['user1', 'user2', 'user3']).toContain(picked?.username);
    expect(issued.map((entry) => entry.sql)).toEqual([
      'SELECT max(rowid) AS top FROM users',
      expect.stringMatching(/^SELECT canonical_username FROM users WHERE rowid IN \(\?(, \?)*\)$/),
    ]);
  });

  it('answers null when no profile is stored', async () => {
    const { db } = fakeTable([], userRow);

    expect(await new RandomRepository(db, seeded(7)).pickUser()).toBeNull();
  });
});
