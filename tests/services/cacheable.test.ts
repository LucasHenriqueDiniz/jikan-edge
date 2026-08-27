import { describe, expect, it, vi } from 'vitest';
import type { CacheEntry, CacheRepository } from '../../src/repositories/cache.repository';
import type { RefreshLockRepository } from '../../src/repositories/refresh-lock.repository';
import { withCache, type CacheDeps, type WaitUntil } from '../../src/services/cacheable';

const FRESH = '2999-01-01T00:00:00.000Z';

function deps(stored: CacheEntry | null): CacheDeps & { put: ReturnType<typeof vi.fn>; acquire: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } {
  const put = vi.fn(async () => {});
  const acquire = vi.fn(async () => true);
  const release = vi.fn(async () => {});
  const cache = { get: async () => stored, put, isFresh: (value: CacheEntry) => Date.parse(value.expiresAt) > Date.now() } as unknown as CacheRepository;
  const locks = { acquire, release } as unknown as RefreshLockRepository;
  return { cache, locks, put, acquire, release };
}

// Stands in for the Workers ExecutionContext: collects the promises handed to waitUntil so a test
// can await the work that outlives the response.
function background(): WaitUntil & { settled: () => Promise<unknown[]> } {
  const pending: Promise<unknown>[] = [];
  const waitUntil = ((promise: Promise<unknown>) => { pending.push(promise); }) as WaitUntil & { settled: () => Promise<unknown[]> };
  waitUntil.settled = () => Promise.all(pending);
  return waitUntil;
}

// Expired one second ago, so it is inside the revalidate window for any TTL above a second.
const JUST_EXPIRED = new Date(Date.now() - 1_000).toISOString();

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

  // A caller whose refresh() can run long (a multi-page list scrape) needs a lease that outlives
  // the default 30s, or a second concurrent request reads the lock as abandoned mid-refresh and
  // starts a redundant scrape in parallel.
  it('passes a caller-supplied lease through to the lock instead of the repository default', async () => {
    const dependencies = deps(entry('v2'));
    await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req', 300);
    expect(dependencies.acquire).toHaveBeenCalledWith('user:x:profile', 'req', 300);
  });

  it('leaves the lease undefined when the caller does not supply one', async () => {
    const dependencies = deps(entry('v2'));
    await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(dependencies.acquire).toHaveBeenCalledWith('user:x:profile', 'req', undefined);
  });
});

// Before this, the request that tripped the TTL waited out the whole upstream fetch while every
// request arriving beside it was handed the stale row instantly by the lock-contended branch. The
// penalty landed on whoever got there first.
describe('withCache serving stale while it revalidates', () => {
  it('answers from the stale row immediately and refreshes behind the response', async () => {
    const waitUntil = background();
    const dependencies = { ...deps(entry('v3', JUST_EXPIRED)), waitUntil };
    // A refresh that cannot finish until this test lets it: if the answer depended on it, awaiting
    // withCache below would hang instead of returning.
    let finishRefresh = (): void => {};
    const refresh = vi.fn(() => new Promise<string>((resolve) => { finishRefresh = () => resolve('new'); }));

    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', refresh, 'req');

    expect(result).toMatchObject({ data: 'stored', cached: true, stale: true, refreshFailed: false });
    // The upstream call is still in flight, and the freshness row has not been rewritten yet.
    expect(dependencies.put).not.toHaveBeenCalled();

    finishRefresh();
    await waitUntil.settled();
    expect(refresh).toHaveBeenCalledOnce();
    expect(dependencies.put).toHaveBeenCalledWith(expect.objectContaining({ parserVersion: 'v3' }));
  });

  // The background task owns the lock once the response leaves, so it has to be the one to drop it.
  // Releasing on the way out instead would let a second request start a duplicate scrape.
  it('holds the lock until the background refresh finishes, then releases it', async () => {
    const waitUntil = background();
    const dependencies = { ...deps(entry('v3', JUST_EXPIRED)), waitUntil };
    await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(dependencies.release).not.toHaveBeenCalled();
    await waitUntil.settled();
    expect(dependencies.release).toHaveBeenCalledWith('user:x:profile', 'req');
  });

  // Nobody is left to receive the error — the caller already has a 200 — so it must not surface as
  // an unhandled rejection, and the response must not have been affected by it.
  it('swallows a background refresh failure without disturbing the answer already sent', async () => {
    const waitUntil = background();
    const dependencies = { ...deps(entry('v3', JUST_EXPIRED)), waitUntil };
    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => { throw new Error('upstream down'); }, 'req');
    expect(result).toMatchObject({ data: 'stored', stale: true, refreshFailed: false });
    await expect(waitUntil.settled()).resolves.toBeDefined();
    expect(dependencies.release).toHaveBeenCalledOnce();
  });

  // A version bump means the stored value is not merely older but wrong — the empty genre lists of
  // 2026-08-27 are the case in point. Those callers wait and get the corrected value. This is the
  // one place where the version *is* checked; the failure fallbacks below still ignore it, because
  // there the alternative is answering nothing at all.
  it('does not serve a stale row written by a different parser version', async () => {
    const waitUntil = background();
    const dependencies = { ...deps(entry('v2', JUST_EXPIRED)), waitUntil };
    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false });
  });

  // Past one TTL beyond expiry — the same window `Cache-Control: stale-while-revalidate` advertises
  // — the row is old enough that handing it back is worse than making the caller wait.
  it('makes the caller wait once the row is older than the revalidate window', async () => {
    const waitUntil = background();
    const longExpired = new Date(Date.now() - 3_600 * 1_000).toISOString();
    const dependencies = { ...deps(entry('v3', longExpired)), waitUntil };
    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false });
  });

  // Without an ExecutionContext there is nothing keeping a detached promise alive, so refreshing
  // inline is the only honest option. This is also what keeps the test suite deterministic.
  it('refreshes inline when there is no way to keep work alive past the response', async () => {
    const dependencies = deps(entry('v3', JUST_EXPIRED));
    const result = await withCache(dependencies, 'user:x:profile', 60, 'v3', async () => 'stored', async () => 'new', 'req');
    expect(result).toMatchObject({ data: 'new', cached: false, stale: false });
    expect(dependencies.release).toHaveBeenCalledOnce();
  });
});
