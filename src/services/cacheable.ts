import type { CacheRepository } from '../repositories/cache.repository';
import type { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import type { SourceResult } from '../source/source-types';

export class ServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) { super(message); }
}

export interface ServiceResponse<T> { data: T; cached: boolean; stale: boolean; refreshFailed: boolean; fetchedAt: string; }

export function sourceError(result: Exclude<SourceResult<string>, { kind: 'success' }>): ServiceError {
  const mapping: Record<string, [string, number]> = { not_found: ['NOT_FOUND', 404], private: ['PRIVATE_PROFILE', 403], rate_limited: ['UPSTREAM_RATE_LIMITED', 429], timeout: ['UPSTREAM_TIMEOUT', 504], suspicious: ['UPSTREAM_SUSPICIOUS', 502], upstream_error: ['UPSTREAM_UNAVAILABLE', 503] };
  const [code, status] = mapping[result.kind];
  return new ServiceError(code, status, 'Unable to refresh this resource.');
}

export interface CacheDeps { cache: CacheRepository; locks: RefreshLockRepository; }

export async function withCache<T>(deps: CacheDeps, key: string, ttl: number, parserVersion: string, read: () => Promise<T | null>, refresh: () => Promise<T>, owner: string): Promise<ServiceResponse<T>> {
  const [cache, stored] = await Promise.all([deps.cache.get(key), read()]);
  if (cache && stored && cache.parserVersion === parserVersion && deps.cache.isFresh(cache)) return { data: stored, cached: true, stale: false, refreshFailed: false, fetchedAt: cache.fetchedAt };
  // The stale fallbacks below deliberately do NOT re-check `parserVersion`. After a change to the
  // *shape* of a payload that would mean serving the previous shape back, flagged only as
  // `stale: true` — but refusing instead would give up the one property this API is built on:
  // answering while MyAnimeList is unreachable. Most version bumps change values (a better image
  // URL, paragraph breaks), where the old row is valid and merely worse. The shape case is handled
  // where it belongs, by a migration that deletes the affected rows outright (see 0010), so they
  // are never reachable as a fallback in the first place.
  const locked = await deps.locks.acquire(key, owner);
  if (!locked) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: false, fetchedAt: cache.fetchedAt };
    throw new ServiceError('REFRESH_IN_PROGRESS', 503, 'Resource refresh is already in progress.');
  }
  try {
    const value = await refresh();
    const fetchedAt = new Date().toISOString();
    // The bookkeeping write to cache_entries is separate from refresh() succeeding: by this point
    // `value` is already the new data (refresh() persisted it to the domain table itself). A
    // failure writing this row only means the next request may re-check freshness sooner than
    // ideal — it must not throw away data we already have and report it as a failed refresh.
    try {
      await deps.cache.put({ resourceKey: key, fetchedAt, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), sourceStatus: 'success', parserVersion });
    } catch (bookkeepingError) {
      console.warn(JSON.stringify({ type: 'cache_bookkeeping_failed', key, error: String(bookkeepingError) }));
    }
    return { data: value, cached: false, stale: false, refreshFailed: false, fetchedAt };
  } catch (error) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: true, fetchedAt: cache.fetchedAt };
    throw error;
  } finally { await deps.locks.release(key, owner); }
}
