import { describe, expect, it, vi } from 'vitest';
import type { CacheEntry, CacheRepository } from '../../src/repositories/cache.repository';
import type { RefreshLockRepository } from '../../src/repositories/refresh-lock.repository';
import { withCache, type CacheDeps } from '../../src/services/cacheable';

const FRESH = '2999-01-01T00:00:00.000Z';

function deps(entry: CacheEntry | null, options: { locked?: boolean } = {}): CacheDeps & { put: ReturnType<typeof vi.fn> } {
  const put = vi.fn(async () => {});
  const cache = {
    get: async () => entry,
    put,
    isFresh: (value: CacheEntry) => Date.parse(value.expiresAt) > Date.now(),
  } as unknown as CacheRepository;
  const locks = {
    acquire: async () => options.locked !== false,
    release: async () => {},
  } as unknown as RefreshLockRepository;
  return { cache, locks, put };
}

function entry(parserVersion: string, expiresAt = FRESH): CacheEntry {
  return { resourceKey: 'user:x:profile', expiresAt, fetchedAt: '2026-07-30T00:00:00.000Z', sourceStatus: 'success', parserVersion };
}

describe('withCache', () => {
  it('serves a fresh snapshot written by the current parser without refetching', async () => {
    const refresh = vi.fn(async () => 'new');
    const result = await withCache(deps(entry('v2')), 'user:x:profile', 60, 'v2', async () => 'stored', refresh, 'req');
    expect(refresh).not.toHaveBeenCalled();
    expect(result).toMatchObject({ data: 'stored', cached: true, stale: false });
  });

  it('refetches a snapshot written by an older parser even while its TTL is still valid', async () => {
    const refresh = vi.fn(async () => 'new');
    const result = await withCache(deps(entry('v1')), 'user:x:profile', 60, 'v2', async () => 'stored', refresh, 'req');
    expect(refresh).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false });
  });

  it('refetches once the TTL expires', async () => {
    const refresh = vi.fn(async () => 'new');
    await withCache(deps(entry('v2', '2000-01-01T00:00:00.000Z')), 'user:x:profile', 60, 'v2', async () => 'stored', refresh, 'req');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('falls back to the old snapshot when the refetch fails', async () => {
    const refresh = vi.fn(async () => { throw new Error('upstream down'); });
    const result = await withCache(deps(entry('v1')), 'user:x:profile', 60, 'v2', async () => 'stored', refresh, 'req');
    expect(result).toMatchObject({ data: 'stored', cached: true, stale: true, refreshFailed: true });
  });

  it('records the current parser version when it writes a snapshot', async () => {
    const dependencies = deps(entry('v1'));
    await withCache(dependencies, 'user:x:profile', 60, 'v2', async () => 'stored', async () => 'new', 'req');
    expect(dependencies.put).toHaveBeenCalledWith(expect.objectContaining({ resourceKey: 'user:x:profile', parserVersion: 'v2' }));
  });
});
