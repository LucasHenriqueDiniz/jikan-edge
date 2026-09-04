import type { AnimeDetail } from '../../domain/anime';
import type { CharacterDetail } from '../../domain/character';
import type { ClubDetail } from '../../domain/club';
import type { MediaType, UserMediaListEntry } from '../../domain/list-entry';
import type { MangaDetail } from '../../domain/manga';
import type { PersonDetail } from '../../domain/person';
import type { ProducerDetail } from '../../domain/producer';
import type { RandomKind } from '../../domain/random';
import type { UserProfile, UserStatistics } from '../../domain/user';
import type { Favorites } from '../../domain/user-favorites';
import type { UserUpdates } from '../../domain/user-updates';

/**
 * Six of the resources store one payload per MyAnimeList id and nothing else, so they are one
 * generic member rather than six identical hand-written ones. Writing them out separately was the
 * first draft; it added sixty lines that differed only in a type argument, and a reader has to
 * compare them character by character to see that they are in fact the same conversation.
 */
export interface DetailStore<T> {
  get(malId: number): Promise<T | null>;
  put(detail: T, fetchedAt: string, version: string): Promise<void>;
}

/** The same, for resources keyed by a username rather than a numeric id. */
export interface KeyedStore<T> {
  get(key: string): Promise<T | null>;
  put(key: string, value: T, fetchedAt: string, version: string): Promise<void>;
}

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
 * Complete as of slice 3: every one of the twelve services reads its store through this interface,
 * and `src/services/` no longer names `D1Database` anywhere.
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
  readonly anime: DetailStore<AnimeDetail>;
  readonly manga: DetailStore<MangaDetail>;
  readonly characters: DetailStore<CharacterDetail>;
  readonly people: DetailStore<PersonDetail>;
  readonly clubs: DetailStore<ClubDetail>;
  readonly producers: DetailStore<ProducerDetail>;
  readonly favorites: KeyedStore<Favorites>;
  readonly updates: KeyedStore<UserUpdates>;
  readonly catalogLists: {
    get<T>(resourceKey: string): Promise<T | null>;
    put<T>(resourceKey: string, payload: T, fetchedAt: string, version: string): Promise<void>;
  };
  /**
   * The profile side is not a `KeyedStore`: it reads and writes two payloads at once (the profile
   * and its statistics), and the list is a collection rather than a payload. Forcing it into the
   * generic would have meant renaming its methods to fit a shape it does not have.
   */
  readonly users: {
    getProfile(key: string): Promise<UserProfile | null>;
    getStatistics(key: string): Promise<UserStatistics | null>;
    saveProfile(profile: UserProfile, stats: UserStatistics): Promise<void>;
    replaceList(key: string, mediaType: MediaType, entries: UserMediaListEntry[]): Promise<void>;
    listEntries(
      key: string,
      mediaType: MediaType,
      page: number,
      limit: number,
    ): Promise<{ entries: UserMediaListEntry[]; total: number }>;
  };
  /**
   * `RandomService` is the one that had no repository at all — it wrote `ORDER BY RANDOM()` against
   * `this.db` directly, which is why it was also the only service with no factory in `src/app.ts`.
   * The SQL moved to `RandomRepository`; the 404 policy for an empty local catalog stayed in the
   * service, so this answers `null` rather than throwing.
   */
  readonly randomPicks: {
    pick(kind: RandomKind): Promise<{ data: unknown; fetchedAt: string } | null>;
    pickUser(): Promise<{ username: string } | null>;
  };
}
