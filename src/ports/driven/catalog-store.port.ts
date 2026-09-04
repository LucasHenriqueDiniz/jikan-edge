import type { AnimeDetail } from '../../domain/anime';

/**
 * What the store knows about a cached resource, separate from the payload itself: when it was
 * fetched, when it goes stale, and which parser produced it. Lives here rather than in
 * `cache.repository.ts` because the port owns its contract — the adapter imports this, not the
 * other way round.
 */
export interface CacheEntry {
  resourceKey: string;
  expiresAt: string;
  fetchedAt: string;
  sourceStatus: string;
  parserVersion: string;
}

/**
 * The store conversation: keep catalog payloads, their freshness bookkeeping, and the leases that
 * stop two requests refreshing the same key at once.
 *
 * One port, not one per repository — see
 * [the ADR](../../../docs/architecture/adr-ports-for-driven-dependencies.md). Twelve interfaces is
 * the port explosion the house style names by hand as the failure mode.
 *
 * **Why the methods are grouped into members instead of flattened.** The ADR costed this as "one
 * interface carrying the 28 public methods", which taken literally means flat — and flat collides:
 * `get` and `put` mean four different things here (a cache entry, a lease, an anime row, a catalog
 * list). Resolving that needs either renamed methods (`readAnime`, `readCatalogList`, …), which
 * rewrites `withCache` and all twelve services, or nested members, which does not. `CacheDeps`
 * projects the two members `withCache` needs straight out of this type, so the eleven services that
 * still build their own repositories keep compiling untouched and slice 3 can move them one at a
 * time. Same single port, same method count, grouped by the sub-conversation each one belongs to.
 *
 * **No D1 type appears below, and that is the test of whether this is a port at all.** Not
 * `D1Database`, not `D1Result`, not `D1PreparedStatement`. `refreshLeases.acquire` returning
 * `boolean` is where that was in real doubt: the adapter reads `result.meta.changes` to decide, and
 * a port that handed back the `D1Result` for the caller to interpret would have been the driver with
 * an interface in front of it. It answers the question instead — did I get the lease — which is what
 * the caller asked.
 *
 * Carries what `AnimeService` needs today. Slice 3 adds the remaining resource members as it moves
 * each service over.
 */
export interface CatalogStore {
  readonly cacheEntries: {
    get(resourceKey: string): Promise<CacheEntry | null>;
    put(entry: CacheEntry): Promise<void>;
    isFresh(entry: CacheEntry, now?: Date): boolean;
  };
  readonly refreshLeases: {
    acquire(resourceKey: string, owner: string, leaseSeconds?: number): Promise<boolean>;
    release(resourceKey: string, owner: string): Promise<void>;
  };
  readonly anime: {
    get(malId: number): Promise<AnimeDetail | null>;
    put(detail: AnimeDetail, fetchedAt: string, version: string): Promise<void>;
  };
  readonly catalogLists: {
    get<T>(resourceKey: string): Promise<T | null>;
    put<T>(resourceKey: string, payload: T, fetchedAt: string, version: string): Promise<void>;
  };
}
