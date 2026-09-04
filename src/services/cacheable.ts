import type { CatalogStore } from '../ports/driven/catalog-store.port';
import type { SourceResult } from '../source/source-types';

// Every status a ServiceError is actually constructed with, across direct `new ServiceError(...)`
// call sites and sourceError's upstream-kind mapping below. Narrowed from `number` so errors.ts can
// hand `error.status` straight to Hono's `c.json` without a cast that told the type system every
// ServiceError is a 400 — which a typed client generated from this app (Hono's `hc<AppType>()`)
// would have taken literally.
export type ServiceErrorStatus = 400 | 403 | 404 | 429 | 501 | 502 | 503 | 504 | 507;

export class ServiceError extends Error {
  constructor(public readonly code: string, public readonly status: ServiceErrorStatus, message: string) { super(message); }
}

// `ttlSeconds` is how long this resource stays fresh, carried out to the HTTP layer so
// `Cache-Control` can state the *remaining* freshness instead of a guess. Optional because a few
// responses are not produced by withCache at all (the random picks read D1 directly), and those
// must not advertise any cache lifetime.
export interface ServiceResponse<T> { data: T; cached: boolean; stale: boolean; refreshFailed: boolean; fetchedAt: string; ttlSeconds?: number; }

/**
 * Whether a failed write is D1 refusing the row for being too big.
 *
 * The match is deliberately just `SQLITE_TOOBIG` — the code SQLite itself raises — and not anything
 * looser like "too big" or a size check of our own. Same reasoning as `no such table` mapping to
 * DATABASE_NOT_MIGRATED and nothing else: widen this and an ordinary bug starts getting reported to
 * the caller as a capacity limit, which sends whoever debugs it in the wrong direction.
 *
 * Measured against the real remote D1 on 2026-08-27, writing bound parameters exactly the way the
 * repositories do: 4,194,256 bytes stores, 4,194,257 raises
 * `D1_ERROR: string or blob too big: SQLITE_TOOBIG`. That is 4 MiB minus the 48 bytes the row's
 * other columns occupy — the ceiling is per **row**, confirmed by padding the primary key by 1,000
 * bytes and watching the boundary drop by the same amount. Nothing truncates: every value under the
 * ceiling reads back byte-identical.
 *
 * Note this is roughly twice what Cloudflare documents (2,000,000 bytes, "maximum string, BLOB or
 * table row size"). The undocumented headroom is not something to build on — it can be aligned with
 * the documentation at any time, and the largest payload here is already 60% of the *documented*
 * ceiling — but it is the reason this is a guard rail today rather than an outage.
 */
export function isOversizeRow(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause instanceof Error ? error.cause.message : '';
  return `${error.message} ${cause}`.includes('SQLITE_TOOBIG');
}

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

// Projected out of the store port rather than declared fresh, so this is the same contract the
// adapter is checked against and not a second copy of it that can drift. Only the two members
// withCache actually talks to: it reads and writes cache bookkeeping and holds a refresh lease, and
// has no business reaching the payload tables.
export interface CacheDeps { cache: CatalogStore['cacheEntries']; locks: CatalogStore['refreshLeases']; waitUntil?: WaitUntil; }

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
        // An oversize row is called out separately: it is the failure that will still be happening
        // tomorrow, and it would otherwise be one line among transient upstream blips.
        .catch((error) => (isOversizeRow(error)
          ? console.error(JSON.stringify({ type: 'payload_too_large', key, parserVersion, servingStale: true }))
          : console.warn(JSON.stringify({ type: 'background_refresh_failed', key, error: error instanceof Error ? error.message : String(error) }))))
        .finally(() => deps.locks.release(key, owner)),
    );
    return { data: stored, cached: true, stale: true, refreshFailed: false, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
  }

  try {
    const { value, fetchedAt } = await runRefresh();
    return { data: value, cached: false, stale: false, refreshFailed: false, fetchedAt, ttlSeconds: ttl };
  } catch (error) {
    // A row D1 will not accept is a different animal from an upstream outage, and it is the more
    // dangerous of the two because it never clears on its own: MyAnimeList comes back, a document
    // that outgrew the row limit does not shrink. Logged at error level either way, because the
    // branch that keeps answering is exactly the branch nobody would notice.
    if (isOversizeRow(error)) {
      console.error(JSON.stringify({ type: 'payload_too_large', key, parserVersion, servingStale: Boolean(stored && cache) }));
      if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: true, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
      throw new ServiceError('PAYLOAD_TOO_LARGE', 507, 'This resource is larger than this deployment can store.');
    }
    if (stored && cache) return { data: stored, cached: true, stale: true, refreshFailed: true, fetchedAt: cache.fetchedAt, ttlSeconds: ttl };
    throw error;
  } finally { await deps.locks.release(key, owner); }
}
