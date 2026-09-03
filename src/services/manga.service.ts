import type { RuntimeConfig } from '../config/env';
import { MANGA_PARSER_VERSION, TOP_MANGA_PARSER_VERSION, type MangaDetail, type MangaListEntry } from '../domain/manga';
import { TOP_MANGA_FILTERS } from '../source/mal-urls';
import { parseTopFilter } from './top-filter';
import type { ExternalLink, RelationEntry } from '../domain/anime';
import { GENRE_PARSER_VERSION, type GenreTaxonomyEntry } from '../domain/genre';
import { MAGAZINE_PARSER_VERSION, type Magazine } from '../domain/magazine';
import { CHARACTERS_STAFF_PARSER_VERSION, type CharacterRole } from '../domain/characters-staff';
import { STATISTICS_PARSER_VERSION, type EntryStatistics } from '../domain/statistics';
import { PICTURES_PARSER_VERSION, type Picture } from '../domain/picture';
import { NEWS_PARSER_VERSION, type NewsItem } from '../domain/news';
import { FORUM_PARSER_VERSION, type ForumThread } from '../domain/forum';
import { MORE_INFO_PARSER_VERSION, type MoreInfo } from '../domain/more-info';
import { TITLE_RECOMMENDATIONS_PARSER_VERSION, type TitleRecommendation } from '../domain/title-recommendation';
import { TITLE_REVIEWS_PARSER_VERSION, type TitleReview } from '../domain/title-review';
import { parseMangaDetail } from '../parsers/manga-detail.parser';
import { parseGenreTaxonomy } from '../parsers/genre-taxonomy.parser';
import { parseTopManga } from '../parsers/top-manga.parser';
import { parseMagazines } from '../parsers/magazines.parser';
import { parseCharacters } from '../parsers/characters-staff.parser';
import { TITLE_USERUPDATES_PARSER_VERSION, type TitleUserUpdate } from '../domain/title-userupdates';
import { parseTitleUserUpdates } from '../parsers/title-userupdates.parser';
import { parseStatistics } from '../parsers/statistics.parser';
import { parsePictures } from '../parsers/pictures.parser';
import { parseNews } from '../parsers/news.parser';
import { parseForum } from '../parsers/forum.parser';
import { parseMoreInfo } from '../parsers/more-info.parser';
import { parseTitleRecommendations } from '../parsers/title-recommendations.parser';
import { parseTitleReviews } from '../parsers/title-reviews.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { MangaRepository } from '../repositories/manga.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import { MalClient } from '../source/mal-client';
import {
  charactersUrl,
  forumUrl,
  genreTaxonomyUrl,
  magazinesUrl,
  mangaDetailUrl,
  moreInfoUrl,
  newsUrl,
  picturesUrl,
  statisticsUrl,
  titleRecommendationsUrl,
  titleReviewsUrl,
  topMangaUrl,
} from '../source/mal-urls';
import { CHARACTER_PAGE_BUDGET, refreshLeaseSecondsFor } from '../source/fetch-policy';
import { type CacheDeps, ServiceError, type ServiceResponse, sourceError, type WaitUntil, withCache } from './cacheable';
import { parseGenreFilter } from './genre-filter';

const GENRES_CACHE_KEY = 'catalog:genres:manga';
const MAGAZINES_CACHE_KEY = 'catalog:magazines';

export class MangaService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly deps: CacheDeps;
  private readonly manga: MangaRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: CatalogSource;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: CatalogSource, waitUntil?: WaitUntil) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.deps = { cache: this.cache, locks: this.locks, waitUntil }; this.manga = new MangaRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_MANGA_ID', 400, 'Manga id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<MangaDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache(this.deps, `manga:${malId}:detail`, this.config.animeTtlSeconds, MANGA_PARSER_VERSION, () => this.manga.get(malId), async () => {
      const source = await this.source.getHtml(mangaDetailUrl(malId), ['Score:', 'Genre']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parseMangaDetail(source.value, malId, fetchedAt);
      await this.manga.put(detail, fetchedAt, MANGA_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  // The MAL manga detail page already carries everything Jikan's "full" schema would add
  // (relations, external links) — there's no separate theme-songs/streaming concept for manga,
  // so full() is a plain alias of detail() rather than a second fetch of the same data.
  full(rawId: string, requestId: string): Promise<ServiceResponse<MangaDetail>> {
    return this.detail(rawId, requestId);
  }

  async relations(rawId: string, requestId: string): Promise<ServiceResponse<RelationEntry[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.relations };
  }

  async externalLinks(rawId: string, requestId: string): Promise<ServiceResponse<ExternalLink[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.externalLinks };
  }

  async characters(rawId: string, requestId: string): Promise<ServiceResponse<CharacterRole[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:manga:${malId}:characters`;
    return withCache(this.deps, cacheKey, this.config.animeTtlSeconds, CHARACTERS_STAFF_PARSER_VERSION, () => this.catalog.get<CharacterRole[]>(cacheKey), async () => {
      const source = await this.source.getHtml(charactersUrl('manga', malId), ['js-manga-character-table'], CHARACTER_PAGE_BUDGET);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseCharacters(source.value, 'manga');
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CHARACTERS_STAFF_PARSER_VERSION);
      return value;
    }, requestId, refreshLeaseSecondsFor(CHARACTER_PAGE_BUDGET));
  }

  async genres(rawFilter: string | undefined, requestId: string): Promise<ServiceResponse<GenreTaxonomyEntry[]>> {
    const filter = parseGenreFilter(rawFilter);
    const result = await withCache(this.deps, GENRES_CACHE_KEY, this.config.catalogTtlSeconds, GENRE_PARSER_VERSION, () => this.catalog.get<GenreTaxonomyEntry[]>(GENRES_CACHE_KEY), async () => {
      const source = await this.source.getHtml(genreTaxonomyUrl('manga'), ['category-type', 'name="genre[]"']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseGenreTaxonomy(source.value, 'manga');
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(GENRES_CACHE_KEY, value, fetchedAt, GENRE_PARSER_VERSION);
      return value;
    }, requestId);
    return filter ? { ...result, data: result.data.filter((entry) => entry.type === filter) } : result;
  }

  async topManga(page: number, rawFilter: string | undefined, requestId: string): Promise<ServiceResponse<MangaListEntry[]>> {
    const filter = parseTopFilter(rawFilter, TOP_MANGA_FILTERS);
    const cacheKey = `catalog:top:manga:page:${page}${filter ? `:${filter}` : ''}`;
    return withCache(this.deps, cacheKey, this.config.catalogTtlSeconds, TOP_MANGA_PARSER_VERSION, () => this.catalog.get<MangaListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(topMangaUrl(page, filter), ['ranking-list']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTopManga(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TOP_MANGA_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async magazines(rawQuery: string | undefined, requestId: string): Promise<ServiceResponse<Magazine[]>> {
    const result = await withCache(this.deps, MAGAZINES_CACHE_KEY, this.config.catalogTtlSeconds, MAGAZINE_PARSER_VERSION, () => this.catalog.get<Magazine[]>(MAGAZINES_CACHE_KEY), async () => {
      const source = await this.source.getHtml(magazinesUrl(), ['genre-name-link']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseMagazines(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(MAGAZINES_CACHE_KEY, value, fetchedAt, MAGAZINE_PARSER_VERSION);
      return value;
    }, requestId);
    const query = (rawQuery ?? '').trim().toLowerCase();
    return query ? { ...result, data: result.data.filter((magazine) => magazine.name.toLowerCase().includes(query)) } : result;
  }

  private async perMangaResource<T>(
    rawId: string,
    resource: string,
    url: string,
    requiredMarkers: string[],
    parserVersion: string,
    parse: (html: string) => T,
    requestId: string,
  ): Promise<ServiceResponse<T>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:manga:${malId}:${resource}`;
    return withCache(this.deps, cacheKey, this.config.animeTtlSeconds, parserVersion, () => this.catalog.get<T>(cacheKey), async () => {
      const source = await this.source.getHtml(url, requiredMarkers);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parse(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, parserVersion);
      return value;
    }, requestId);
  }

  statistics(rawId: string, requestId: string): Promise<ServiceResponse<EntryStatistics>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'statistics', statisticsUrl('manga', malId), ['Summary Stats'], STATISTICS_PARSER_VERSION, (html) => parseStatistics(html), requestId);
  }

  userUpdates(rawId: string, requestId: string): Promise<ServiceResponse<TitleUserUpdate[]>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'userupdates', statisticsUrl('manga', malId), ['Summary Stats'], TITLE_USERUPDATES_PARSER_VERSION, parseTitleUserUpdates, requestId);
  }

  pictures(rawId: string, requestId: string): Promise<ServiceResponse<Picture[]>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'pictures', picturesUrl('manga', malId), ['js-picture-gallery'], PICTURES_PARSER_VERSION, parsePictures, requestId);
  }

  news(rawId: string, requestId: string): Promise<ServiceResponse<NewsItem[]>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'news', newsUrl('manga', malId), ['read more'], NEWS_PARSER_VERSION, parseNews, requestId);
  }

  forum(rawId: string, requestId: string): Promise<ServiceResponse<ForumThread[]>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'forum', forumUrl('manga', malId), ['data-topic-id'], FORUM_PARSER_VERSION, parseForum, requestId);
  }

  recommendations(rawId: string, requestId: string): Promise<ServiceResponse<TitleRecommendation[]>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'recommendations', titleRecommendationsUrl('manga', malId), ['picSurround'], TITLE_RECOMMENDATIONS_PARSER_VERSION, (html) => parseTitleRecommendations(html, 'manga'), requestId);
  }

  reviews(rawId: string, page: number, requestId: string): Promise<ServiceResponse<TitleReview[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:manga:${malId}:reviews:page:${page}`;
    return withCache(this.deps, cacheKey, this.config.animeTtlSeconds, TITLE_REVIEWS_PARSER_VERSION, () => this.catalog.get<TitleReview[]>(cacheKey), async () => {
      const source = await this.source.getHtml(titleReviewsUrl('manga', malId, page), ['review-element']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTitleReviews(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TITLE_REVIEWS_PARSER_VERSION);
      return value;
    }, requestId);
  }

  moreInfo(rawId: string, requestId: string): Promise<ServiceResponse<MoreInfo>> {
    const malId = this.validateMalId(rawId);
    return this.perMangaResource(rawId, 'moreinfo', moreInfoUrl('manga', malId), ['id="content"'], MORE_INFO_PARSER_VERSION, parseMoreInfo, requestId);
  }
}
