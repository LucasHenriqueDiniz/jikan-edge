import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env } from 'cloudflare:test';
import { RetentionRepository } from '../../src/repositories/retention.repository';

// Against a real SQLite (miniflare's D1) with the real migrations, because what is under test is the
// SQL itself: which rows a prune touches, in which order, and what it leaves alone.
const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const db = () => bindings.DB;

const CUTOFF = '2026-11-02T00:00:00.000Z'; // what a run on 2026-11-16 computes with 14 days of retention

async function cacheRow(key: string, expiresAt: string) {
  await db()
    .prepare(
      'INSERT INTO cache_entries(resource_key, expires_at, fetched_at, source_status, parser_version) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(key, expiresAt, expiresAt, 'success', 'v')
    .run();
}
async function payloadRow(key: string) {
  await db()
    .prepare('INSERT INTO catalog_lists(resource_key, payload_json, fetched_at, parser_version) VALUES (?, ?, ?, ?)')
    .bind(key, '[1,2,3]', '2026-01-01T00:00:00.000Z', 'v')
    .run();
}
async function animeRow(malId: number) {
  await db()
    .prepare('INSERT INTO anime(mal_id, title, payload_json, fetched_at, parser_version) VALUES (?, ?, ?, ?, ?)')
    .bind(malId, 'Title', '{}', '2026-01-01T00:00:00.000Z', 'v')
    .run();
}
const keys = async (table: 'cache_entries' | 'catalog_lists') =>
  (
    await db().prepare(`SELECT resource_key FROM ${table} ORDER BY resource_key`).all<{ resource_key: string }>()
  ).results.map((row) => row.resource_key);

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => {
  for (const table of ['cache_entries', 'catalog_lists', 'anime']) await db().prepare(`DELETE FROM ${table}`).run();
});

describe('pruneExpiredBefore', () => {
  it('deletes an entry that expired before the cutoff, with the catalog payload under its key', async () => {
    await cacheRow('user:someone:friends', '2026-10-20T00:00:00.000Z');
    await payloadRow('user:someone:friends');

    const result = await new RetentionRepository(db()).pruneExpiredBefore(CUTOFF, 500);

    expect(result).toMatchObject({ cacheEntries: 1, payloads: 1 });
    expect(result.databaseBytes).toBeGreaterThan(0);
    expect(await keys('cache_entries')).toEqual([]);
    expect(await keys('catalog_lists')).toEqual([]);
  });

  it('keeps what expired after the cutoff, and what has not expired at all', async () => {
    await cacheRow('catalog:anime:1:episodes:page:1', '2026-11-10T00:00:00.000Z');
    await payloadRow('catalog:anime:1:episodes:page:1');
    await cacheRow('catalog:anime:2:episodes:page:1', '2026-12-31T00:00:00.000Z');
    await payloadRow('catalog:anime:2:episodes:page:1');

    const result = await new RetentionRepository(db()).pruneExpiredBefore(CUTOFF, 500);

    expect(result).toMatchObject({ cacheEntries: 0, payloads: 0 });
    expect(await keys('catalog_lists')).toEqual(['catalog:anime:1:episodes:page:1', 'catalog:anime:2:episodes:page:1']);
  });

  // `anime:1:detail` keeps its payload in `anime`, which /v1/random/anime draws from. Only the cache
  // row goes; the title stays in the local catalogue.
  it('leaves a payload stored outside catalog_lists in place', async () => {
    await cacheRow('anime:1:detail', '2026-10-20T00:00:00.000Z');
    await animeRow(1);

    const result = await new RetentionRepository(db()).pruneExpiredBefore(CUTOFF, 500);

    expect(result).toMatchObject({ cacheEntries: 1, payloads: 0 });
    expect((await db().prepare('SELECT count(*) AS n FROM anime').first<{ n: number }>())?.n).toBe(1);
  });

  it('never touches a catalog payload whose cache entry is not being pruned', async () => {
    await payloadRow('catalog:orphan');
    await cacheRow('user:someone:friends', '2026-10-20T00:00:00.000Z');

    await new RetentionRepository(db()).pruneExpiredBefore(CUTOFF, 500);

    expect(await keys('catalog_lists')).toEqual(['catalog:orphan']);
  });

  it('takes the oldest first and stops at the limit', async () => {
    for (const [key, expiresAt] of [
      ['c', '2026-10-03T00:00:00.000Z'],
      ['a', '2026-10-01T00:00:00.000Z'],
      ['b', '2026-10-02T00:00:00.000Z'],
    ]) {
      await cacheRow(key, expiresAt);
      await payloadRow(key);
    }
    const repository = new RetentionRepository(db());

    expect(await repository.pruneExpiredBefore(CUTOFF, 2)).toMatchObject({ cacheEntries: 2, payloads: 2 });
    expect(await keys('cache_entries')).toEqual(['c']);
    expect(await keys('catalog_lists')).toEqual(['c']);

    expect(await repository.pruneExpiredBefore(CUTOFF, 2)).toMatchObject({ cacheEntries: 1, payloads: 1 });
    expect(await keys('cache_entries')).toEqual([]);
  });
});
