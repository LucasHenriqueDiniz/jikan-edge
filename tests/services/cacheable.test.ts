import { describe, expect, it, vi } from 'vitest';
import type { CacheEntry, CacheRepository } from '../../src/repositories/cache.repository';
import type { RefreshLockRepository } from '../../src/repositories/refresh-lock.repository';
import { withCache, type CacheDeps } from '../../src/services/cacheable';

const FRESH = '2999-01-01T00:00:00.000Z';

function deps(stored: CacheEntry | null): CacheDeps & { put: ReturnType<typeof vi.fn> } {
  const put = vi.fn(async () => {});
  const cache = { get: async () => stored, put, isFresh: (value: CacheEntry) => Date.parse(value.expiresAt) > Date.now() } as unknown as CacheRepository;
  const locks = { acquire: async () => true, release: async () => {} } as unknown as RefreshLockRepository;
  return { cache, locks, put };
}

function entry(parserVersion: string, expiresAt = FRESH): CacheEntry {
  return { resourceKey: 'user:x:profile', expiresAt, fetchedAt: '2026-07-30T00:00:00.000Z', sourceStatus: 'success', parserVersion };
}

describe('withCache', () => {
  it('serves a fresh snapshot written by the current parser without refetching', async () => {
    const refresh = vi.fn(async () => 'new');
    const result = await withCache(deps(entry('v3')), 'user:x:profile', 60, 'v3', async () => 'stored', refresh, 'req');
    expect(refresh).not.toHaveBeenCalled();
    expect(result).toMatchObject({ data: 'stored', cached: true, stale: false });
  });

  // Without this, a parser fix never reaches anyone already holding a snapshot: the row keeps serving the
  // old values — and stays missing any newly added field — until the TTL happens to lapse.
  it('refetches a snapshot written by an older parser even while its TTL is still valid', async () => {
    const refresh = vi.fn(async () => 'new');
    const result = await withCache(deps(entry('v2')), 'user:x:profile', 60, 'v3', async () => 'stored', refresh, 'req');
    expect(refresh).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false });
  });

  it('refetches once the TTL expires', async () => {
    const refresh = vi.fn(async () => 'new');
    await withCache(deps(entry('v3', '2000-01-01T00:00:00.000Z')), 'user:x:profile', 60, 'v3', async () => 'stored', refresh, 'req');
    expect(refresh).toHaveBeenCalledOnce();
  });

  // A mismatched row still beats a 503, and the response already flags it. This is a deliberate
  // trade and not an oversight: refusing here would surrender the property this API exists for —
  // answering while MyAnimeList is unreachable. A version bump that changes the *shape* of a
  // payload is handled by deleting those rows in a migration, so they never reach this path.
  it('falls back to the version-mismatched snapshot when the refetch fails', async () => {
    const refresh = vi.fn(async () => { throw new Error('upstream down'); });
    const result = await withCache(deps(entry('v2')), 'user:x:profile', 60, 'v3', async () => 'stored', refresh, 'req');
    expect(result).toMatchObject({ data: 'stored', cached: true, stale: true, refreshFailed: true });
  });

  it('records the current parser version when it writes a snapshot', async () => {
    const dependencies = deps(entry('v2'));
    await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(dependencies.put).toHaveBeenCalledWith(expect.objectContaining({ resourceKey: 'user:x:profile', parserVersion: 'v3' }));
  });

  // refresh() already persisted the new value to its own domain table by the time cache.put() runs
  // — that write is only the freshness bookkeeping. Losing it must not throw away data we already
  // have, nor report a successful refresh as `refreshFailed`.
  it('still returns the freshly refreshed value when only the cache bookkeeping write fails', async () => {
    const dependencies = deps(entry('v2'));
    dependencies.put.mockImplementationOnce(async () => { throw new Error('D1 blip'); });
    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false, refreshFailed: false });
  });
});
