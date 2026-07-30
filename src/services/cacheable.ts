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
  // A snapshot is only reusable if the parser that wrote it still agrees with the current one: a parser fix
  // changes the values (or the shape) of an already-stored row, and TTL alone would keep serving the old one.
  const usable = cache !== null && cache.parserVersion === parserVersion;
  if (cache && stored && usable && deps.cache.isFresh(cache)) return { data: stored, cached: true, stale: false, refreshFailed: false, fetchedAt: cache.fetchedAt };
  const locked = await deps.locks.acquire(key, owner);
  if (!locked) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: false, fetchedAt: cache.fetchedAt };
    throw new ServiceError('REFRESH_IN_PROGRESS', 503, 'Resource refresh is already in progress.');
  }
  try {
    const value = await refresh();
    const fetchedAt = new Date().toISOString();
    await deps.cache.put({ resourceKey: key, fetchedAt, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), sourceStatus: 'success', parserVersion });
    return { data: value, cached: false, stale: false, refreshFailed: false, fetchedAt };
  } catch (error) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: true, fetchedAt: cache.fetchedAt };
    throw error;
  } finally { await deps.locks.release(key, owner); }
}
