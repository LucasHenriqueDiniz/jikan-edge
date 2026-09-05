import { describe, expect, it } from 'vitest';
import type { RuntimeConfig } from '../../src/config/env';
import type { AnimeDetail } from '../../src/domain/anime';
import { GENRE_PARSER_VERSION, type GenreTaxonomyEntry } from '../../src/domain/genre';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import type { CacheEntry, CatalogStore } from '../../src/ports/driven/catalog-store.port';
import { AnimeService } from '../../src/services/anime.service';
import { ServiceError } from '../../src/services/cacheable';
import type { SourceResult } from '../../src/source/source-types';

// The point of this file is what it does NOT contain: no `D1Database`, no `applyD1Migrations`, no
// `cloudflare:test` import, and no `as never`. AnimeService is built from nothing but the two ports,
// so it runs in the plain node project rather than the Workers pool.
//
// That makes the compiler the assertion. If either port were to start carrying a driver type — a
// `D1Database` parameter, a `D1Result` return — the fakes below could not satisfy it and this file
// would stop compiling. Per the slice's stop condition that is the signal the abstraction is
// decorative: the driver with an interface in front of it. A green run here means the boundary is
// real, and the run being green without a database anywhere is the evidence.

const config: RuntimeConfig = {
  profileTtlSeconds: 60,
  listTtlSeconds: 60,
  animeTtlSeconds: 3_600,
  catalogTtlSeconds: 3_600,
  sourceTimeoutMs: 1_000,
  maxUpstreamBytes: 2_000_000,
  malUserAgent: 'test',
};

// An in-memory implementation of the store port — all four collaborators the service used to build
// for itself out of a raw binding. Maps, not SQL, and the port cannot tell the difference.
function inMemoryStore(seed: { cacheEntries?: CacheEntry[]; catalogLists?: Record<string, unknown> } = {}) {
  const cacheEntries = new Map<string, CacheEntry>(
    (seed.cacheEntries ?? []).map((entry) => [entry.resourceKey, entry]),
  );
  const catalogLists = new Map<string, unknown>(Object.entries(seed.catalogLists ?? {}));
  const animeRows = new Map<number, AnimeDetail>();
  const held = new Set<string>();
  const released: string[] = [];

  const store: CatalogStore = {
    cacheEntries: {
      async get(resourceKey) {
        return cacheEntries.get(resourceKey) ?? null;
      },
      async put(entry) {
        cacheEntries.set(entry.resourceKey, entry);
      },
      isFresh(entry, now = new Date()) {
        return Date.parse(entry.expiresAt) > now.getTime();
      },
    },
    refreshLeases: {
      async acquire(resourceKey) {
        if (held.has(resourceKey)) return false;
        held.add(resourceKey);
        return true;
      },
      async release(resourceKey) {
        held.delete(resourceKey);
        released.push(resourceKey);
      },
    },
    anime: {
      async get(malId) {
        return animeRows.get(malId) ?? null;
      },
      async put(detail) {
        animeRows.set(detail.malId, detail);
      },
    },
    catalogLists: {
      async get<T>(resourceKey: string): Promise<T | null> {
        return (catalogLists.get(resourceKey) ?? null) as T | null;
      },
      async put<T>(resourceKey: string, payload: T): Promise<void> {
        catalogLists.set(resourceKey, payload);
      },
    },
    // The nine members slice 3 added to the port for the other eleven services. `AnimeService` does
    // not read any of them, and these throw rather than answering null or empty so that stays true:
    // a service quietly starting to depend on one would go green against a permissive fake instead
    // of saying it changed what it needs.
    manga: unread('manga'),
    characters: unread('characters'),
    people: unread('people'),
    clubs: unread('clubs'),
    producers: unread('producers'),
    favorites: unread('favorites'),
    updates: unread('updates'),
    users: unread('users'),
    randomPicks: unread('randomPicks'),
  };
  return { store, held, released };
}

// Every method answers by failing, and the Proxy means a member gains no maintenance cost when the
// port grows a method.
function unread<T extends object>(member: string): T {
  return new Proxy({} as T, {
    get: (_target, method) => () => {
      throw new Error(`AnimeService read store.${member}.${String(method)}, which it is not supposed to touch`);
    },
  });
}

// The fifth collaborator. Records every URL it is asked for, so a test can assert the source was
// never consulted — which is the only way to prove a cache hit came from the store.
function countingSource(answer: () => Promise<SourceResult<string>>) {
  const calls: string[] = [];
  const source: CatalogSource = {
    async getHtml(url) {
      calls.push(url);
      return answer();
    },
  };
  return { source, calls };
}

const GENRES_KEY = 'catalog:genres:anime';

describe('AnimeService built from ports alone', () => {
  it('serves a fresh catalog list out of the injected store without consulting the source', async () => {
    const genres: GenreTaxonomyEntry[] = [
      { malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action', count: 5_000, type: 'genres' },
      { malId: 29, name: 'Space', url: 'https://myanimelist.net/anime/genre/29/Space', count: 700, type: 'themes' },
    ];
    const entry: CacheEntry = {
      resourceKey: GENRES_KEY,
      expiresAt: '2999-01-01T00:00:00.000Z',
      fetchedAt: '2026-09-03T00:00:00.000Z',
      sourceStatus: 'success',
      parserVersion: GENRE_PARSER_VERSION,
    };
    const { store } = inMemoryStore({ cacheEntries: [entry], catalogLists: { [GENRES_KEY]: genres } });
    const { source, calls } = countingSource(async () => {
      throw new Error('the source must not be consulted on a fresh hit');
    });

    const service = new AnimeService(store, source, config);
    const result = await service.genres(undefined, 'req-1');

    expect(result).toMatchObject({ cached: true, stale: false, refreshFailed: false, fetchedAt: entry.fetchedAt });
    expect(result.data).toEqual(genres);
    expect(calls).toEqual([]);
  });

  it('applies the genre filter to what the store returned', async () => {
    const genres: GenreTaxonomyEntry[] = [
      { malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action', count: 5_000, type: 'genres' },
      { malId: 29, name: 'Space', url: 'https://myanimelist.net/anime/genre/29/Space', count: 700, type: 'themes' },
    ];
    const entry: CacheEntry = {
      resourceKey: GENRES_KEY,
      expiresAt: '2999-01-01T00:00:00.000Z',
      fetchedAt: '2026-09-03T00:00:00.000Z',
      sourceStatus: 'success',
      parserVersion: GENRE_PARSER_VERSION,
    };
    const { store } = inMemoryStore({ cacheEntries: [entry], catalogLists: { [GENRES_KEY]: genres } });
    const { source } = countingSource(async () => {
      throw new Error('unreachable');
    });

    const service = new AnimeService(store, source, config);

    expect((await service.genres('themes', 'req-2')).data).toEqual([genres[1]]);
  });

  // The cold path: nothing in the store, so the lease is taken, the source is asked, and its
  // domain-shaped refusal becomes the HTTP-shaped one. The lease must come back either way —
  // withCache releases it in a `finally`, and a leaked lease would block the key for its whole
  // 30-second term.
  it('turns a not_found from the injected source into a 404 and releases the lease', async () => {
    const { store, held, released } = inMemoryStore();
    const { source, calls } = countingSource(async () => ({
      kind: 'not_found',
      metadata: {
        url: 'https://myanimelist.net/anime/1',
        status: 404,
        contentType: 'text/html',
        durationMs: 1,
        sizeBytes: 0,
      },
    }));

    const service = new AnimeService(store, source, config);

    await expect(service.detail('1', 'req-3')).rejects.toBeInstanceOf(ServiceError);
    expect(calls).toHaveLength(1);
    expect(released).toEqual(['anime:1:detail']);
    expect(held.size).toBe(0);
  });

  it('rejects a malformed id before reaching either port', async () => {
    const { store } = inMemoryStore();
    const { source, calls } = countingSource(async () => {
      throw new Error('validation runs first');
    });

    const service = new AnimeService(store, source, config);

    await expect(service.detail('not-a-number', 'req-4')).rejects.toMatchObject({
      code: 'INVALID_ANIME_ID',
      status: 400,
    });
    expect(calls).toEqual([]);
  });
});
