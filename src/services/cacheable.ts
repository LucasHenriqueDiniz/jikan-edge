import type { CacheRepository } from '../repositories/cache.repository';
import type { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import type { SourceResult } from '../source/source-types';

// Every status a ServiceError is actually constructed with, across direct `new ServiceError(...)`
// call sites and sourceError's upstream-kind mapping below. Narrowed from `number` so errors.ts can
// hand `error.status` straight to Hono's `c.json` without a cast that told the type system every
// ServiceError is a 400 — which a typed client generated from this app (Hono's `hc<AppType>()`)
// would have taken literally.
export type ServiceErrorStatus = 400 | 403 | 404 | 429 | 501 | 502 | 503 | 504;

export class ServiceError extends Error {
  constructor(public readonly code: string, public readonly status: ServiceErrorStatus, message: string) { super(message); }
}

// `ttlSeconds` is how long this resource stays fresh, carried out to the HTTP layer so
// `Cache-Control` can state the *remaining* freshness instead of a guess. Optional because a few
// responses are not produced by withCache at all (the random picks read D1 directly), and those
// must not advertise any cache lifetime.
export interface ServiceResponse<T> { data: T; cached: boolean; stale: boolean; refreshFailed: boolean; fetchedAt: string; ttlSeconds?: number; }

export function sourceError(result: Exclude<SourceResult<string>, { kind: 'success' }>): ServiceError {
  const mapping: Record<string, [string, ServiceErrorStatus]> = { not_found: ['NOT_FOUND', 404], private: ['PRIVATE_PROFILE', 403], rate_limited: ['UPSTREAM_RATE_LIMITED', 429], timeout: ['UPSTREAM_TIMEOUT', 504], suspicious: ['UPSTREAM_SUSPICIOUS', 502], upstream_error: ['UPSTREAM_UNAVAILABLE', 503] };
  const [code, status] = mapping[result.kind];
  return new ServiceError(code, status, 'Unable to refresh this resource.');
}

/**
 * Keeps work alive after the response is sent. On Workers this is `ExecutionContext.waitUntil`; the
 * runtime is free to tear the isolate down once a response is returned, so a promise that is merely
 * left unawaited may never finish. Optional throughout: without it every refresh runs inline, which
 * is exactly how this module behaved before, so tests and any non-Workers caller stay deterministic.
 */
export type WaitUntil = (promise: Promise<unknown>) => void;

export interface CacheDeps { cache: CacheRepository; locks: RefreshLockRepository; waitUntil?: WaitUntil; }

// Whether a resource went stale recently enough to be worth serving while it refreshes. The window
// is one more TTL past expiry, which is exactly what `Cache-Control: stale-while-revalidate=<ttl>`
// already promises downstream — the internal behaviour and the advertised one are the same rule.
// Past that, or with an unreadable timestamp, the caller waits for fresh data instead.
function withinRevalidateWindow(expiresAt: string, ttl: number, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  return !Number.isNaN(expiry) && now < expiry + ttl * 1_000;
}

export async function withCache<T>(deps: CacheDeps, key: string, ttl: number, parserVersion: string, read: () => Promise<T | null>, refresh: () => Promise<T>, owner: string, leaseSeconds?: number): Promise<ServiceResponse<T>> {
  const [cache, stored] = await Promise.all([deps.cache.get(key), read()]);
  if (cache && stored && cache.parserVersion === parserVersion && deps.cache.isFresh(cache)) return { data: stored, cached: true, stale: false, refreshFailed: false, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
  // The stale fallbacks below deliberately do NOT re-check `parserVersion`. After a change to the
  // *shape* of a payload that would mean serving the previous shape back, flagged only as
  // `stale: true` — but refusing instead would give up the one property this API is built on:
  // answering while MyAnimeList is unreachable. Most version bumps change values (a better image
  // URL, paragraph breaks), where the old row is valid and merely worse. The shape case is handled
  // where it belongs, by a migration that deletes the affected rows outright (see 0010), so they
  // are never reachable as a fallback in the first place.
  // `leaseSeconds` defaults to RefreshLockRepository's own 30s when omitted — that's plenty for a
  // single-page refresh. A caller whose `refresh` can run long (a multi-page list scrape) passes a
  // longer one explicitly, so a slow-but-healthy refresh doesn't lose its lock mid-flight to a
  // second request that reads the lease as abandoned and starts a redundant scrape in parallel.
  const locked = await deps.locks.acquire(key, owner, leaseSeconds);
  if (!locked) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: false, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
    throw new ServiceError('REFRESH_IN_PROGRESS', 503, 'Resource refresh is already in progress.');
  }
  const runRefresh = async (): Promise<{ value: T; fetchedAt: string }> => {
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
    return { value, fetchedAt };
  };

  // Serve the stale copy now and refresh behind the response. Without this, the one request unlucky
  // enough to trip the TTL paid the full upstream cost — seconds against MyAnimeList — while every
  // request arriving beside it got the stale row instantly from the branch just above. The penalty
  // fell on whoever arrived first, which is backwards.
  //
  // Deliberately NOT done when `parserVersion` differs. The stale *fallbacks* ignore the version on
  // purpose (see the note above): there, the alternative is answering nothing at all. Here the
  // alternative is a few seconds of waiting, and a bump means the stored value is not merely older
  // but wrong — the empty genre lists of 2026-08-27 are the case in point. Those callers wait and
  // get the corrected value; they do not get the bad one one last time.
  if (deps.waitUntil && stored && cache && cache.parserVersion === parserVersion && withinRevalidateWindow(cache.expiresAt, ttl)) {
    deps.waitUntil(
      runRefresh()
        // Nobody is left to receive this failure: the caller already has a 200 with the stale body.
        // The stored row keeps its old expiry, so the next request retries rather than backing off.
        .catch((error) => console.warn(JSON.stringify({ type: 'background_refresh_failed', key, error: error instanceof Error ? error.message : String(error) })))
        .finally(() => deps.locks.release(key, owner)),
    );
    return { data: stored, cached: true, stale: true, refreshFailed: false, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
  }

  try {
    const { value, fetchedAt } = await runRefresh();
    return { data: value, cached: false, stale: false, refreshFailed: false, fetchedAt, ttlSeconds: ttl };
  } catch (error) {
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: true, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
    throw error;
  } finally { await deps.locks.release(key, owner); }
}
