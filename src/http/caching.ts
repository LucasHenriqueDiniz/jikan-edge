/**
 * HTTP cache validators and freshness, kept out of `app.ts` so both are directly testable.
 *
 * Before this existed, no response carried `Cache-Control` or `ETag` at all — every one of the 98
 * routes was uncacheable by omission, so a browser, a CDN, or a caller's HTTP client had no way to
 * reuse an answer or to ask whether it had changed. A client polling a route re-downloaded an
 * identical body every time, and the heaviest route in the catalogue is 1.13 MB.
 */

/** What a response needs to describe its own freshness. `ttlSeconds` absent = not cacheable. */
export interface Freshness {
  stale: boolean;
  fetchedAt?: string;
  ttlSeconds?: number;
}

export const NO_STORE = 'no-store';

/**
 * Whether a stored row has outlived its TTL.
 *
 * `withCache` works this out internally and reports it as `meta.stale`. The random picks are the
 * one read path that bypasses `withCache` entirely — they draw a row straight from the local
 * catalogue and never refresh it — so they compute the same answer here rather than claiming a
 * freshness nobody checked. An unreadable timestamp counts as stale: not knowing how old a payload
 * is is not a reason to call it fresh.
 */
export function isStale(fetchedAt: string, ttlSeconds: number, now = Date.now()): boolean {
  const fetchedAtMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedAtMs)) return true;
  return now - fetchedAtMs >= ttlSeconds * 1_000;
}

/**
 * `Cache-Control` for a successful response, or `null` when the caller has no TTL to advertise.
 *
 * max-age is the freshness that REMAINS, not the whole TTL. A resource fetched five hours into a
 * six-hour TTL has one hour of life left; advertising six would let a shared cache keep serving it
 * for five hours after this API already considers it stale.
 *
 * A stale body advertises `max-age=0` so the next request revalidates rather than compounding the
 * staleness downstream. `stale-while-revalidate` lets a shared cache keep answering during a
 * refresh, which mirrors what this API already does internally and spares callers the multi-second
 * upstream wait that a cold refresh costs.
 */
export function cacheControlFor(freshness: Freshness, now = Date.now()): string | null {
  if (freshness.ttlSeconds === undefined) return null;
  const fetchedAtMs = freshness.fetchedAt ? Date.parse(freshness.fetchedAt) : Number.NaN;
  // An unparseable or future timestamp must not produce a longer life than the TTL allows, so age
  // floors at 0 and the result is clamped rather than trusted.
  const ageSeconds = Number.isNaN(fetchedAtMs) ? 0 : Math.max(0, (now - fetchedAtMs) / 1000);
  const remaining = freshness.stale ? 0 : Math.max(0, Math.floor(freshness.ttlSeconds - ageSeconds));
  return `public, max-age=${remaining}, stale-while-revalidate=${freshness.ttlSeconds}`;
}

/**
 * Strong validator over the bytes actually sent.
 *
 * Deliberately a hash of the body rather than of `(key, fetchedAt)`: `meta.cached` flips from false
 * to true between the request that refreshed a payload and every read after it, so a tag derived
 * from cache bookkeeping would declare two visibly different bodies identical. Hashing the body is
 * correct by construction, and two cached reads of an unchanged resource are byte-identical —
 * success responses carry no request id — so the 304 path still fires whenever it should.
 *
 * 64 bits of SHA-256, which is far more than a cache validator needs and keeps the header short.
 */
export async function etagFor(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', body);
  const hex = [...new Uint8Array(digest).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `"${hex}"`;
}

/**
 * Whether an `If-None-Match` header matches `etag`.
 *
 * Not a string comparison: the header is a *list* (`"a", "b"`), may be `*`, and may mark entries
 * weak with a `W/` prefix. A caller sending any of those with a plain equality check would have its
 * conditional request silently ignored and be handed the full body — the failure would look like
 * "revalidation just doesn't work here" rather than an error, which is the hardest kind to notice.
 * Weak comparison is the right one for `If-None-Match` per RFC 9110.
 */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const normalise = (value: string) => value.trim().replace(/^W\//, '');
  if (normalise(ifNoneMatch) === '*') return true;
  return ifNoneMatch.split(',').map(normalise).includes(normalise(etag));
}
