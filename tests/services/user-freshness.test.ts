import { describe, expect, it, vi } from 'vitest';
import type { RuntimeConfig } from '../../src/config/env';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import type { CatalogStore } from '../../src/ports/driven/catalog-store.port';
import type { ServiceResponse } from '../../src/services/cacheable';
import { ttlUntilFirstExpiry, UserService } from '../../src/services/user.service';
import { cacheControlFor } from '../../src/http/caching';

// `/v1/users/:u/statistics` and `/v1/users/:u/full` built their answer by hand and left out the TTL,
// so the route had nothing to announce and sent no Cache-Control at all (measured in production on
// 2026-11-18: `hit`, no header, where every other cached route says `public, max-age=…`).

const config = { profileTtlSeconds: 21_600 } as RuntimeConfig;
const stats = { anime: {}, manga: {} };
const store = {
  cacheEntries: {},
  refreshLeases: {},
  users: { getStatistics: async () => stats },
  favorites: {},
  updates: {},
  catalogLists: {},
} as unknown as CatalogStore;
const source = {} as CatalogSource;

const part = (fetchedAt: string, ttlSeconds = 21_600): ServiceResponse<never> => ({
  data: {} as never,
  cached: true,
  stale: false,
  refreshFailed: false,
  fetchedAt,
  ttlSeconds,
});

describe('user freshness', () => {
  it('gives statistics the TTL of the profile it is written with', async () => {
    const service = new UserService(store, source, config);
    vi.spyOn(service, 'profile').mockResolvedValue(part('2026-11-18T10:00:00.000Z') as never);

    const result = await service.statistics('Xinil', 'r');

    expect(result.ttlSeconds).toBe(21_600);
    expect(cacheControlFor(result, Date.parse('2026-11-18T11:00:00.000Z'))).toBe(
      'public, max-age=18000, stale-while-revalidate=21600',
    );
  });

  it('gives full the time until its oldest part expires, counted from the profile', async () => {
    const service = new UserService(store, source, config);
    vi.spyOn(service, 'profile').mockResolvedValue(part('2026-11-18T10:00:00.000Z') as never);
    // Favorites cached four hours before the profile: two hours of freshness left when it was read.
    vi.spyOn(service, 'favoritesFor').mockResolvedValue(part('2026-11-18T06:00:00.000Z') as never);
    vi.spyOn(service, 'userUpdates').mockResolvedValue(part('2026-11-18T09:00:00.000Z') as never);

    const result = await service.fullProfile('Xinil', 'r');

    expect(result.fetchedAt).toBe('2026-11-18T10:00:00.000Z');
    expect(result.ttlSeconds).toBe(2 * 3600);
    expect(cacheControlFor(result, Date.parse('2026-11-18T11:00:00.000Z'))).toBe(
      'public, max-age=3600, stale-while-revalidate=7200',
    );
  });
});

describe('ttlUntilFirstExpiry', () => {
  it('is undefined when a part carries no TTL', () => {
    expect(
      ttlUntilFirstExpiry('2026-11-18T10:00:00.000Z', [{ fetchedAt: '2026-11-18T10:00:00.000Z' }]),
    ).toBeUndefined();
  });

  it('never goes below zero for a part that expired before the profile was fetched', () => {
    expect(
      ttlUntilFirstExpiry('2026-11-18T10:00:00.000Z', [{ fetchedAt: '2026-11-17T00:00:00.000Z', ttlSeconds: 60 }]),
    ).toBe(0);
  });
});
