import type { RuntimeConfig } from '../config/env';
import { CHARACTER_SEARCH_PARSER_VERSION, type CharacterSearchResult } from '../domain/character-search';
import { PERSON_SEARCH_PARSER_VERSION, type PersonSearchResult } from '../domain/person-search';
import { ANIME_SEARCH_PARSER_VERSION, MANGA_SEARCH_PARSER_VERSION, type AnimeSearchEntry, type MangaSearchEntry, type SearchEntry } from '../domain/search';
import { USER_SEARCH_PARSER_VERSION, type UserSearchResult } from '../domain/user-search';
import { parseCharacterSearch } from '../parsers/character-search.parser';
import { parsePersonSearch } from '../parsers/person-search.parser';
import { parseAnimeSearchResults, parseMangaSearchResults } from '../parsers/search.parser';
import { parseUserSearch } from '../parsers/user-search.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { searchUrl, userSearchUrl } from '../source/mal-urls';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

const MAX_QUERY_LENGTH = 64;

export interface TitleSearchFilters {
  type?: string; status?: string; rating?: string; score?: string; minScore?: string;
  genres?: string; genresExclude?: string; orderBy?: string; sort?: string; letter?: string;
}

// All values verified against real anime.php/manga.php responses (server-side filtering confirmed;
// see docs/routes.md). order_by uses the sort-column codes from the results-table header links.
const ANIME_TYPE_MAP: Record<string, string> = { tv: '1', ova: '2', movie: '3', special: '4', ona: '5', music: '6' };
const MANGA_TYPE_MAP: Record<string, string> = { manga: '1', novel: '2', lightnovel: '2', oneshot: '3', doujin: '4', manhwa: '5', manhua: '6' };
const STATUS_MAP: Record<string, string> = { airing: '1', publishing: '1', complete: '2', finished: '2', upcoming: '3' };
const RATING_MAP: Record<string, string> = { g: '1', pg: '2', pg13: '3', r17: '4', r: '5', rx: '6' };
const ORDER_BY_MAP: Record<string, string> = { score: '3', episodes: '4', volumes: '4', type: '6' };

function buildTitleSearchParams(type: 'anime' | 'manga', filters: TitleSearchFilters): [string, string][] {
  const extra: [string, string][] = [];
  const fail = (name: string, allowed: string[]): never => { throw new ServiceError('INVALID_FILTER', 400, `Invalid "${name}"; allowed: ${allowed.join(', ')}.`); };
  if (filters.type) {
    const map = type === 'anime' ? ANIME_TYPE_MAP : MANGA_TYPE_MAP;
    extra.push(['type', map[filters.type.toLowerCase()] ?? fail('type', Object.keys(map))]);
  }
  if (filters.status) extra.push(['status', STATUS_MAP[filters.status.toLowerCase()] ?? fail('status', Object.keys(STATUS_MAP))]);
  if (filters.rating) {
    if (type !== 'anime') throw new ServiceError('INVALID_FILTER', 400, '"rating" only applies to anime search.');
    extra.push(['r', RATING_MAP[filters.rating.toLowerCase()] ?? fail('rating', Object.keys(RATING_MAP))]);
  }
  // MAL's form has one score dropdown, and it is a minimum — so `score` and `min_score` are the
  // same knob under two names. Accepting both is for people porting from Jikan; setting both to
  // different values is a contradiction worth refusing rather than silently picking one.
  const rawScore = filters.score ?? filters.minScore;
  if (filters.score && filters.minScore && filters.score !== filters.minScore) {
    throw new ServiceError('INVALID_FILTER', 400, '"score" and "min_score" are the same filter on MyAnimeList; pass only one.');
  }
  if (rawScore) {
    const score = Number.parseInt(rawScore, 10);
    if (!Number.isInteger(score) || score < 1 || score > 10 || String(score) !== rawScore) throw new ServiceError('INVALID_FILTER', 400, '"score" must be an integer 1-10.');
    extra.push(['score', String(score)]);
  }
  // `gx=1` flips the meaning of every `genre[]` on the request from "include" to "exclude", so the
  // two cannot be combined — verified against the live search: `genre[]=12` returns 17 results and
  // `genre[]=12&gx=1` returns 20 disjoint ones.
  if (filters.genres && filters.genresExclude) {
    throw new ServiceError('INVALID_FILTER', 400, 'MyAnimeList applies one genre mode per request; pass "genres" or "genres_exclude", not both.');
  }
  const genreList = filters.genres ?? filters.genresExclude;
  if (genreList) {
    const name = filters.genres ? 'genres' : 'genres_exclude';
    for (const raw of genreList.split(',')) {
      const genreId = Number.parseInt(raw.trim(), 10);
      if (!Number.isInteger(genreId) || genreId <= 0) throw new ServiceError('INVALID_FILTER', 400, `"${name}" must be comma-separated positive genre ids.`);
      extra.push(['genre[]', String(genreId)]);
    }
    if (filters.genresExclude) extra.push(['gx', '1']);
  }
  if (filters.letter) {
    if (!/^[A-Za-z]$/.test(filters.letter)) throw new ServiceError('INVALID_FILTER', 400, '"letter" must be a single letter.');
    extra.push(['letter', filters.letter.toUpperCase()]);
  }
  if (filters.orderBy) {
    extra.push(['o', ORDER_BY_MAP[filters.orderBy.toLowerCase()] ?? fail('order_by', Object.keys(ORDER_BY_MAP))]);
    // `w` is the direction: 1 descending, 2 ascending. Confirmed against the live search —
    // `o=3&w=1` returns Gintama and Shingeki, `o=3&w=2` returns the bottom of the score table.
    extra.push(['w', filters.sort?.toLowerCase() === 'asc' ? '2' : '1']);
  } else if (filters.sort) {
    throw new ServiceError('INVALID_FILTER', 400, '"sort" needs "order_by" to say which column to sort.');
  }
  if (filters.sort && !['asc', 'desc'].includes(filters.sort.toLowerCase())) {
    throw new ServiceError('INVALID_FILTER', 400, '"sort" must be "asc" or "desc".');
  }
  return extra;
}

export class SearchService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateQuery(rawQuery: string | undefined): string {
    const query = (rawQuery ?? '').trim();
    if (!query || query.length > MAX_QUERY_LENGTH) throw new ServiceError('INVALID_QUERY', 400, 'Query parameter "q" is required and must be 1-64 characters.');
    return query;
  }

  private async search(type: 'anime' | 'manga', rawQuery: string | undefined, page: number, filters: TitleSearchFilters, requestId: string): Promise<ServiceResponse<SearchEntry[]>> {
    const extra = buildTitleSearchParams(type, filters);
    // A pure filter search (no text query) is valid on MAL — q is only required when there are
    // no filters at all, otherwise the request would be an unbounded catalog dump.
    const query = extra.length > 0 && !(rawQuery ?? '').trim() ? '' : this.validateQuery(rawQuery);
    const filterKey = extra.map(([key, value]) => `${key}=${value}`).join('&');
    const cacheKey = `catalog:search:${type}:${query.toLowerCase()}:page:${page}${filterKey ? `:${filterKey}` : ''}`;
    // Separate versions because the two searches no longer share a shape: the anime row's middle
    // column is episodes, the manga row's is volumes.
    const version = type === 'anime' ? ANIME_SEARCH_PARSER_VERSION : MANGA_SEARCH_PARSER_VERSION;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, version, () => this.catalog.get<SearchEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(searchUrl(type, query, page, extra), ['filterByType']);
      if (source.kind !== 'success') throw sourceError(source);
      const value: SearchEntry[] = type === 'anime' ? parseAnimeSearchResults(source.value) : parseMangaSearchResults(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, version);
      return value;
    }, requestId);
  }

  anime(query: string | undefined, page: number, filters: TitleSearchFilters, requestId: string): Promise<ServiceResponse<SearchEntry[]>> { return this.search('anime', query, page, filters, requestId); }
  manga(query: string | undefined, page: number, filters: TitleSearchFilters, requestId: string): Promise<ServiceResponse<SearchEntry[]>> { return this.search('manga', query, page, filters, requestId); }

  users(rawQuery: string | undefined, page: number, requestId: string): Promise<ServiceResponse<UserSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:users:${query.toLowerCase()}:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, USER_SEARCH_PARSER_VERSION, () => this.catalog.get<UserSearchResult[]>(cacheKey), async () => {
      const source = await this.source.getHtml(userSearchUrl(query, page), []);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseUserSearch(source.value, query);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, USER_SEARCH_PARSER_VERSION);
      return value;
    }, requestId);
  }

  characters(rawQuery: string | undefined, page: number, requestId: string): Promise<ServiceResponse<CharacterSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:characters:${query.toLowerCase()}:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, CHARACTER_SEARCH_PARSER_VERSION, () => this.catalog.get<CharacterSearchResult[]>(cacheKey), async () => {
      const source = await this.source.getHtml(searchUrl('character', query, page), ['Search Results']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseCharacterSearch(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CHARACTER_SEARCH_PARSER_VERSION);
      return value;
    }, requestId);
  }

  people(rawQuery: string | undefined, page: number, requestId: string): Promise<ServiceResponse<PersonSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:people:${query.toLowerCase()}:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, PERSON_SEARCH_PARSER_VERSION, () => this.catalog.get<PersonSearchResult[]>(cacheKey), async () => {
      const source = await this.source.getHtml(searchUrl('people', query, page), ['Search Results']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parsePersonSearch(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, PERSON_SEARCH_PARSER_VERSION);
      return value;
    }, requestId);
  }
}
