import type { RuntimeConfig } from '../config/env';
import { LIST_PARSER_VERSION, type MediaType, type UserMediaListEntry } from '../domain/list-entry';
import { PARSER_VERSION, type UserProfile, type UserStatistics, usernameKey } from '../domain/user';
import { LIST_PAGE_SIZE, listLayout, parseUserMediaListSnapshot } from '../parsers/user-list.parser';
import { parseUserProfile, parseUserStatistics } from '../parsers/user-profile.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { UserRepository } from '../repositories/user.repository';
import { FavoritesRepository } from '../repositories/favorites.repository';
import { FAVORITES_PARSER_VERSION, parseUserFavorites, type Favorites } from '../parsers/user-favorites.parser';
import { parseUserUpdates, type UserUpdates } from '../parsers/user-updates.parser';
import { UpdatesRepository } from '../repositories/updates.repository';
import { animeListUrl, mangaListUrl, profileUrl, userSubPageUrl } from '../source/mal-urls';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import { MalClient } from '../source/mal-client';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { USER_SOCIAL_PARSER_VERSION, type UserClub, type UserFriend } from '../domain/user-social';
import { parseUserFriends } from '../parsers/user-friends.parser';
import { parseUserClubs } from '../parsers/user-clubs.parser';
import { REVIEW_PARSER_VERSION, type ReviewEntry } from '../domain/review';
import { parseReviews } from '../parsers/reviews.parser';
import { RECOMMENDATION_PARSER_VERSION, type RecommendationEntry } from '../domain/recommendation';
import { parseRecommendations } from '../parsers/recommendations.parser';
import {
  type CacheDeps,
  ServiceError,
  type ServiceResponse,
  sourceError,
  type WaitUntil,
  withCache,
} from './cacheable';

const UPDATES_PARSER_VERSION = `${PARSER_VERSION}:updates`;
/**
 * Bounds one user's refresh, nothing wider. The largest list measured so far is 2,354 entries (8 pages), so
 * 20 leaves real headroom — and hitting the cap now raises `LIST_TOO_LARGE` instead of quietly storing a
 * prefix, which means the number is wrong loudly rather than the data being wrong silently.
 */
const MAX_LIST_PAGES = 20;
// withCache's default lock lease (30s, RefreshLockRepository's own default) is sized for a single
// upstream fetch. mediaList can make up to MAX_LIST_PAGES sequential fetches, each bounded by
// sourceTimeoutMs — worst case far exceeds 30s. A lease that expires mid-refresh lets a second
// request read the lock as abandoned and start a redundant full scrape of the same list in
// parallel. Sized off the real worst case (pages * per-page timeout) plus headroom for parsing and
// D1 writes between pages, not a guess.
export function listRefreshLeaseSeconds(sourceTimeoutMs: number): number {
  return Math.ceil((MAX_LIST_PAGES * sourceTimeoutMs) / 1000) + 60;
}

export interface UserFullProfile {
  profile: UserProfile;
  statistics: UserStatistics;
  favorites: Favorites;
  updates: UserUpdates;
}

export class UserService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly deps: CacheDeps;
  private readonly users: UserRepository;
  private readonly source: CatalogSource;
  private readonly favorites: FavoritesRepository;
  private readonly updates: UpdatesRepository;
  private readonly catalog: CatalogListRepository;
  constructor(
    private readonly db: D1Database,
    private readonly config: RuntimeConfig,
    source?: CatalogSource,
    waitUntil?: WaitUntil,
  ) {
    this.cache = new CacheRepository(db);
    this.locks = new RefreshLockRepository(db);
    this.deps = { cache: this.cache, locks: this.locks, waitUntil };
    this.users = new UserRepository(db);
    this.favorites = new FavoritesRepository(db);
    this.updates = new UpdatesRepository(db);
    this.catalog = new CatalogListRepository(db);
    this.source = source ?? new MalClient(config);
  }

  private validateUsername(username: string): string {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(username))
      throw new ServiceError('INVALID_USERNAME', 400, 'Username is invalid.');
    return usernameKey(username);
  }

  private withCache<T>(
    key: string,
    ttl: number,
    parserVersion: string,
    read: () => Promise<T | null>,
    refresh: () => Promise<T>,
    owner: string,
    leaseSeconds?: number,
  ): Promise<ServiceResponse<T>> {
    return withCache(this.deps, key, ttl, parserVersion, read, refresh, owner, leaseSeconds);
  }

  async profile(username: string, requestId: string): Promise<ServiceResponse<UserProfile>> {
    const key = this.validateUsername(username);
    return this.withCache(
      `user:${key}:profile`,
      this.config.profileTtlSeconds,
      PARSER_VERSION,
      () => this.users.getProfile(key),
      async () => {
        const source = await this.source.getHtml(profileUrl(username), ['Profile', 'Anime Stats']);
        if (source.kind !== 'success') {
          console.warn(
            JSON.stringify({
              type: 'profile_source_rejected',
              kind: source.kind,
              reason: source.reason,
              metadata: source.metadata,
            }),
          );
          throw sourceError(source);
        }
        const fetchedAt = new Date().toISOString();
        const profile = parseUserProfile(source.value, username, fetchedAt);
        const stats = parseUserStatistics(source.value);
        await this.users.saveProfile(profile, stats);
        return profile;
      },
      requestId,
    );
  }

  async statistics(username: string, requestId: string): Promise<ServiceResponse<UserStatistics>> {
    const key = this.validateUsername(username);
    const profileResult = await this.profile(username, requestId);
    const stats = await this.users.getStatistics(key);
    if (!stats) throw new ServiceError('CACHE_WRITE_FAILED', 503, 'Unable to read refreshed statistics.');
    return {
      data: stats,
      cached: profileResult.cached,
      stale: profileResult.stale,
      refreshFailed: profileResult.refreshFailed,
      fetchedAt: profileResult.fetchedAt,
    };
  }

  async favoritesFor(username: string, requestId: string): Promise<ServiceResponse<Favorites>> {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:favorites`;
    return this.withCache(
      cacheKey,
      this.config.profileTtlSeconds,
      FAVORITES_PARSER_VERSION,
      () => this.favorites.get(key),
      async () => {
        const source = await this.source.getHtml(profileUrl(username), ['Favorites']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseUserFavorites(source.value);
        const fetchedAt = new Date().toISOString();
        await this.favorites.put(key, value, fetchedAt, FAVORITES_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async userUpdates(username: string, requestId: string): Promise<ServiceResponse<UserUpdates>> {
    const key = this.validateUsername(username);
    return this.withCache(
      `user:${key}:updates`,
      this.config.profileTtlSeconds,
      UPDATES_PARSER_VERSION,
      () => this.updates.get(key),
      async () => {
        const source = await this.source.getHtml(profileUrl(username), ['Last Anime Updates']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseUserUpdates(source.value);
        const at = new Date().toISOString();
        await this.updates.put(key, value, at, UPDATES_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async about(username: string, requestId: string): Promise<ServiceResponse<{ about: string | null }>> {
    const result = await this.profile(username, requestId);
    return { ...result, data: { about: result.data.about } };
  }

  async fullProfile(username: string, requestId: string): Promise<ServiceResponse<UserFullProfile>> {
    const profile = await this.profile(username, requestId);
    const statistics = await this.statistics(username, requestId);
    const favorites = await this.favoritesFor(username, requestId);
    const updates = await this.userUpdates(username, requestId);
    return {
      data: { profile: profile.data, statistics: statistics.data, favorites: favorites.data, updates: updates.data },
      cached: profile.cached && statistics.cached && favorites.cached && updates.cached,
      stale: profile.stale || statistics.stale || favorites.stale || updates.stale,
      refreshFailed:
        profile.refreshFailed || statistics.refreshFailed || favorites.refreshFailed || updates.refreshFailed,
      fetchedAt: profile.fetchedAt,
    };
  }

  async friends(username: string, requestId: string): Promise<ServiceResponse<UserFriend[]>> {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:friends`;
    return this.withCache(
      cacheKey,
      this.config.profileTtlSeconds,
      USER_SOCIAL_PARSER_VERSION,
      () => this.catalog.get<UserFriend[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(userSubPageUrl(username, 'friends'), ['Friends']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseUserFriends(source.value);
        await this.catalog.put(cacheKey, value, new Date().toISOString(), USER_SOCIAL_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async clubs(username: string, requestId: string): Promise<ServiceResponse<UserClub[]>> {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:clubs`;
    return this.withCache(
      cacheKey,
      this.config.profileTtlSeconds,
      USER_SOCIAL_PARSER_VERSION,
      () => this.catalog.get<UserClub[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(userSubPageUrl(username, 'clubs'), ['Clubs']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseUserClubs(source.value);
        await this.catalog.put(cacheKey, value, new Date().toISOString(), USER_SOCIAL_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async reviews(username: string, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:reviews`;
    return this.withCache(
      cacheKey,
      this.config.profileTtlSeconds,
      REVIEW_PARSER_VERSION,
      () => this.catalog.get<ReviewEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(userSubPageUrl(username, 'reviews'), ['Reviews']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseReviews(source.value, true);
        await this.catalog.put(cacheKey, value, new Date().toISOString(), REVIEW_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async recommendations(username: string, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:recommendations`;
    return this.withCache(
      cacheKey,
      this.config.profileTtlSeconds,
      RECOMMENDATION_PARSER_VERSION,
      () => this.catalog.get<RecommendationEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(userSubPageUrl(username, 'recommendations'), ['Recommendations']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseRecommendations(source.value, true);
        await this.catalog.put(cacheKey, value, new Date().toISOString(), RECOMMENDATION_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async mediaList(
    username: string,
    mediaType: MediaType,
    requestId: string,
    page: number,
    limit: number,
  ): Promise<
    ServiceResponse<{ entries: Awaited<ReturnType<UserRepository['listEntries']>>['entries']; total: number }>
  > {
    const key = this.validateUsername(username);
    const cacheKey = `user:${key}:${mediaType}-list`;
    return this.withCache(
      cacheKey,
      this.config.listTtlSeconds,
      LIST_PARSER_VERSION,
      async () => this.users.listEntries(key, mediaType, page, limit),
      async () => {
        const marker = mediaType === 'anime' ? 'Anime List' : 'Manga List';
        const fetchedAt = new Date().toISOString();
        const collected: UserMediaListEntry[] = [];
        // The classic layout returns the whole list in one document and ignores `offset`; only the modern one
        // pages. The cap bounds a single user's refresh — it is not a crawl of MAL.
        let exhausted = false;
        for (let pageIndex = 0; pageIndex < MAX_LIST_PAGES && !exhausted; pageIndex += 1) {
          const offset = pageIndex * LIST_PAGE_SIZE;
          const source = await this.source.getHtml(
            mediaType === 'anime' ? animeListUrl(username, offset) : mangaListUrl(username, offset),
            [marker],
          );
          if (source.kind !== 'success') throw sourceError(source);
          const snapshot = parseUserMediaListSnapshot(source.value, username, mediaType, fetchedAt);
          // A later page that comes back empty is simply the end of the list, not a rejected snapshot.
          if (snapshot.kind === 'partial' && snapshot.items.length === 0 && pageIndex > 0) {
            exhausted = true;
            break;
          }
          if (snapshot.kind !== 'complete')
            throw new ServiceError(
              'UPSTREAM_SUSPICIOUS',
              502,
              `List snapshot rejected: ${snapshot.kind === 'empty' ? snapshot.kind : snapshot.reason}.`,
            );
          collected.push(...snapshot.items);
          if (listLayout(source.value) === 'classic' || snapshot.items.length < LIST_PAGE_SIZE) exhausted = true;
        }
        // Leaving the loop with the last page still full means there are more entries than the cap allows.
        // Storing what we have would be the same silent truncation this guard exists to prevent.
        if (!exhausted)
          throw new ServiceError(
            'LIST_TOO_LARGE',
            501,
            `List exceeds the ${MAX_LIST_PAGES * LIST_PAGE_SIZE} entries this API reads in one refresh.`,
          );
        const deduped = [...new Map(collected.map((entry) => [entry.malId, entry])).values()];
        // MAL's list page never states how many entries the list has, so the only cross-check available is the
        // profile's own counter, already stored by a previous profile refresh. Missing entries are what the
        // truncation bug looked like (273 served against 360 declared); a surplus is not — a stale counter
        // simply predates entries the user has since added.
        const declaredTotal = (await this.users.getStatistics(key))?.[mediaType].totalEntries ?? null;
        if (declaredTotal !== null && declaredTotal > 0 && deduped.length < declaredTotal) {
          throw new ServiceError(
            'UPSTREAM_SUSPICIOUS',
            502,
            `List snapshot rejected: extracted ${deduped.length} of ${declaredTotal} declared entries.`,
          );
        }
        await this.users.replaceList(key, mediaType, deduped);
        return this.users.listEntries(key, mediaType, page, limit);
      },
      requestId,
      listRefreshLeaseSeconds(this.config.sourceTimeoutMs),
    );
  }
}
