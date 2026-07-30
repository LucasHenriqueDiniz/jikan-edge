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
import { MalClient } from '../source/mal-client';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { USER_SOCIAL_PARSER_VERSION, type UserClub, type UserFriend } from '../domain/user-social';
import { parseUserFriends } from '../parsers/user-friends.parser';
import { parseUserClubs } from '../parsers/user-clubs.parser';
import { REVIEW_PARSER_VERSION, type ReviewEntry } from '../domain/review';
import { parseReviews } from '../parsers/reviews.parser';
import { RECOMMENDATION_PARSER_VERSION, type RecommendationEntry } from '../domain/recommendation';
import { parseRecommendations } from '../parsers/recommendations.parser';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

const UPDATES_PARSER_VERSION = `${PARSER_VERSION}:updates`;
/** 10 pages of 300 covers every list we have seen; it bounds one user's refresh, nothing wider. */
const MAX_LIST_PAGES = 10;

export interface UserFullProfile { profile: UserProfile; statistics: UserStatistics; favorites: Favorites; updates: UserUpdates }

export class UserService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly users: UserRepository;
  private readonly source: MalClient;
  private readonly favorites: FavoritesRepository;
  private readonly updates: UpdatesRepository;
  private readonly catalog: CatalogListRepository;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.users = new UserRepository(db); this.favorites = new FavoritesRepository(db); this.updates = new UpdatesRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateUsername(username: string): string {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(username)) throw new ServiceError('INVALID_USERNAME', 400, 'Username is invalid.');
    return usernameKey(username);
  }

  private withCache<T>(key: string, ttl: number, parserVersion: string, read: () => Promise<T | null>, refresh: () => Promise<T>, owner: string): Promise<ServiceResponse<T>> {
    return withCache({ cache: this.cache, locks: this.locks }, key, ttl, parserVersion, read, refresh, owner);
  }

  async profile(username: string, requestId: string): Promise<ServiceResponse<UserProfile>> {
    const key = this.validateUsername(username);
    return this.withCache(`user:${key}:profile`, this.config.profileTtlSeconds, PARSER_VERSION, () => this.users.getProfile(key), async () => {
      const source = await this.source.getHtml(profileUrl(username), ['Profile', 'Anime Stats']);
      if (source.kind !== 'success') {
        console.warn(JSON.stringify({ type: 'profile_source_rejected', kind: source.kind, reason: source.reason, metadata: source.metadata }));
        throw sourceError(source);
      }
      const fetchedAt = new Date().toISOString(); const profile = parseUserProfile(source.value, username, fetchedAt); const stats = parseUserStatistics(source.value);
      await this.users.saveProfile(profile, stats); return profile;
    }, requestId);
  }

  async statistics(username: string, requestId: string): Promise<ServiceResponse<UserStatistics>> {
    const key = this.validateUsername(username);
    const profileResult = await this.profile(username, requestId);
    const stats = await this.users.getStatistics(key);
    if (!stats) throw new ServiceError('CACHE_WRITE_FAILED', 503, 'Unable to read refreshed statistics.');
    return { data: stats, cached: profileResult.cached, stale: profileResult.stale, refreshFailed: profileResult.refreshFailed, fetchedAt: profileResult.fetchedAt };
  }

  async favoritesFor(username: string, requestId: string): Promise<ServiceResponse<Favorites>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:favorites`;
    return this.withCache(cacheKey, this.config.profileTtlSeconds, FAVORITES_PARSER_VERSION, () => this.favorites.get(key), async () => {
      const source = await this.source.getHtml(profileUrl(username), ['Favorites']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseUserFavorites(source.value); const fetchedAt = new Date().toISOString();
      await this.favorites.put(key, value, fetchedAt, FAVORITES_PARSER_VERSION); return value;
    }, requestId);
  }

  async userUpdates(username: string, requestId: string): Promise<ServiceResponse<UserUpdates>> {
    const key=this.validateUsername(username); return this.withCache(`user:${key}:updates`,this.config.profileTtlSeconds,UPDATES_PARSER_VERSION,()=>this.updates.get(key),async()=>{const source=await this.source.getHtml(profileUrl(username),['Last Anime Updates']);if(source.kind!=='success')throw sourceError(source);const value=parseUserUpdates(source.value);const at=new Date().toISOString();await this.updates.put(key,value,at);return value},requestId);
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
      refreshFailed: profile.refreshFailed || statistics.refreshFailed || favorites.refreshFailed || updates.refreshFailed,
      fetchedAt: profile.fetchedAt,
    };
  }

  async friends(username: string, requestId: string): Promise<ServiceResponse<UserFriend[]>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:friends`;
    return this.withCache(cacheKey, this.config.profileTtlSeconds, USER_SOCIAL_PARSER_VERSION, () => this.catalog.get<UserFriend[]>(cacheKey), async () => {
      const source = await this.source.getHtml(userSubPageUrl(username, 'friends'), ['Friends']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseUserFriends(source.value);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), USER_SOCIAL_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async clubs(username: string, requestId: string): Promise<ServiceResponse<UserClub[]>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:clubs`;
    return this.withCache(cacheKey, this.config.profileTtlSeconds, USER_SOCIAL_PARSER_VERSION, () => this.catalog.get<UserClub[]>(cacheKey), async () => {
      const source = await this.source.getHtml(userSubPageUrl(username, 'clubs'), ['Clubs']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseUserClubs(source.value);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), USER_SOCIAL_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async reviews(username: string, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:reviews`;
    return this.withCache(cacheKey, this.config.profileTtlSeconds, REVIEW_PARSER_VERSION, () => this.catalog.get<ReviewEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(userSubPageUrl(username, 'reviews'), ['Reviews']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseReviews(source.value, true);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), REVIEW_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async recommendations(username: string, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:recommendations`;
    return this.withCache(cacheKey, this.config.profileTtlSeconds, RECOMMENDATION_PARSER_VERSION, () => this.catalog.get<RecommendationEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(userSubPageUrl(username, 'recommendations'), ['Recommendations']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseRecommendations(source.value, true);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), RECOMMENDATION_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async mediaList(username: string, mediaType: MediaType, requestId: string, page: number, limit: number): Promise<ServiceResponse<{ entries: Awaited<ReturnType<UserRepository['listEntries']>>['entries']; total: number }>> {
    const key = this.validateUsername(username); const cacheKey = `user:${key}:${mediaType}-list`;
    return this.withCache(cacheKey, this.config.listTtlSeconds, LIST_PARSER_VERSION, async () => this.users.listEntries(key, mediaType, page, limit), async () => {
      const marker = mediaType === 'anime' ? 'Anime List' : 'Manga List';
      const fetchedAt = new Date().toISOString();
      const collected: UserMediaListEntry[] = [];
      // The classic layout returns the whole list in one document and ignores `offset`; only the modern one
      // pages. The cap bounds a single user's refresh — it is not a crawl of MAL.
      for (let pageIndex = 0; pageIndex < MAX_LIST_PAGES; pageIndex += 1) {
        const offset = pageIndex * LIST_PAGE_SIZE;
        const source = await this.source.getHtml(mediaType === 'anime' ? animeListUrl(username, offset) : mangaListUrl(username, offset), [marker]);
        if (source.kind !== 'success') throw sourceError(source);
        const snapshot = parseUserMediaListSnapshot(source.value, username, mediaType, fetchedAt);
        // A later page that comes back empty is simply the end of the list, not a rejected snapshot.
        if (snapshot.kind === 'partial' && snapshot.items.length === 0 && pageIndex > 0) break;
        if (snapshot.kind !== 'complete') throw new ServiceError('UPSTREAM_SUSPICIOUS', 502, `List snapshot rejected: ${snapshot.kind === 'empty' ? snapshot.kind : snapshot.reason}.`);
        collected.push(...snapshot.items);
        if (listLayout(source.value) === 'classic' || snapshot.items.length < LIST_PAGE_SIZE) break;
      }
      const deduped = [...new Map(collected.map((entry) => [entry.malId, entry])).values()];
      await this.users.replaceList(key, mediaType, deduped);
      return this.users.listEntries(key, mediaType, page, limit);
    }, requestId);
  }
}
