import type { RuntimeConfig } from '../config/env';
import { ANIME_PARSER_VERSION, SEASON_PARSER_VERSION, TOP_ANIME_PARSER_VERSION, type AnimeDetail, type AnimeListEntry, type ExternalLink, type RelationEntry, type StreamingEntry } from '../domain/anime';
import { GENRE_PARSER_VERSION, type GenreTaxonomyEntry } from '../domain/genre';
import { ANIME_FULL_PARSER_VERSION, type AnimeFull } from '../domain/anime-full';
import type { AnimeThemeSongs } from '../domain/anime-theme';
import { VIDEOS_PARSER_VERSION, type EpisodeVideoEntry, type TitleVideos } from '../domain/videos';
import { EPISODE_DETAIL_PARSER_VERSION, type EpisodeDetail } from '../domain/episode-detail';
import { TITLE_USERUPDATES_PARSER_VERSION, type TitleUserUpdate } from '../domain/title-userupdates';
import { CHARACTERS_STAFF_PARSER_VERSION, type CharacterRole, type StaffMember } from '../domain/characters-staff';
import { STATISTICS_PARSER_VERSION, type EntryStatistics } from '../domain/statistics';
import { PICTURES_PARSER_VERSION, type Picture } from '../domain/picture';
import { NEWS_PARSER_VERSION, type NewsItem } from '../domain/news';
import { FORUM_PARSER_VERSION, type ForumThread } from '../domain/forum';
import { EPISODES_PARSER_VERSION, type Episode } from '../domain/episode';
import { MORE_INFO_PARSER_VERSION, type MoreInfo } from '../domain/more-info';
import { TITLE_RECOMMENDATIONS_PARSER_VERSION, type TitleRecommendation } from '../domain/title-recommendation';
import { TITLE_REVIEWS_PARSER_VERSION, type TitleReview } from '../domain/title-review';
import { parseAnimeDetail } from '../parsers/anime-detail.parser';
import { parseAnimeFull } from '../parsers/anime-full.parser';
import { parseGenreTaxonomy } from '../parsers/genre-taxonomy.parser';
import { parseCharacters, parseStaff } from '../parsers/characters-staff.parser';
import { parseStatistics } from '../parsers/statistics.parser';
import { parsePictures } from '../parsers/pictures.parser';
import { parseNews } from '../parsers/news.parser';
import { parseForum } from '../parsers/forum.parser';
import { parseEpisodes } from '../parsers/episodes.parser';
import { parseMoreInfo } from '../parsers/more-info.parser';
import { parseTitleRecommendations } from '../parsers/title-recommendations.parser';
import { parseTitleReviews } from '../parsers/title-reviews.parser';
import { parseSeasonNow } from '../parsers/season-now.parser';
import { parseTitleVideos } from '../parsers/videos.parser';
import { parseEpisodeDetail } from '../parsers/episode-detail.parser';
import { parseTitleUserUpdates } from '../parsers/title-userupdates.parser';
import { SEASON_ARCHIVE_PARSER_VERSION, parseSeasonArchive, type SeasonArchiveEntry } from '../parsers/season-archive.parser';
import { SCHEDULE_DAYS, SCHEDULE_PARSER_VERSION, parseScheduleByDay, type ScheduleByDay, type ScheduleDay } from '../parsers/schedule.parser';
import { parseTopAnime } from '../parsers/top-anime.parser';
import { AnimeRepository } from '../repositories/anime.repository';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { animeDetailUrl, charactersUrl, episodeDetailUrl, episodesUrl, forumUrl, genreTaxonomyUrl, moreInfoUrl, newsUrl, picturesUrl, scheduleUrl, seasonArchiveUrl, seasonByYearUrl, seasonNowUrl, seasonUpcomingUrl, statisticsUrl, titleRecommendationsUrl, titleReviewsUrl, TOP_ANIME_FILTERS, topAnimeUrl, videosUrl } from '../source/mal-urls';
import { parseTopFilter } from './top-filter';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';
import { parseGenreFilter } from './genre-filter';

const GENRES_CACHE_KEY = 'catalog:genres:anime';
interface AnimeCharactersAndStaff { characters: CharacterRole[]; staff: StaffMember[] }
const VALID_SEASONS = new Set(['winter', 'spring', 'summer', 'fall']);

export class AnimeService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly anime: AnimeRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.anime = new AnimeRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_ANIME_ID', 400, 'Anime id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<AnimeDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache({ cache: this.cache, locks: this.locks }, `anime:${malId}:detail`, this.config.animeTtlSeconds, ANIME_PARSER_VERSION, () => this.anime.get(malId), async () => {
      const source = await this.source.getHtml(animeDetailUrl(malId), ['Score:', 'Genre']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parseAnimeDetail(source.value, malId, fetchedAt);
      await this.anime.put(detail, fetchedAt, ANIME_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<AnimeFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:anime:${malId}:full`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, ANIME_FULL_PARSER_VERSION, () => this.catalog.get<AnimeFull>(cacheKey), async () => {
      const source = await this.source.getHtml(animeDetailUrl(malId), ['Score:', 'Genre']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const full = parseAnimeFull(source.value, malId, fetchedAt);
      await this.catalog.put(cacheKey, full, fetchedAt, ANIME_FULL_PARSER_VERSION);
      return full;
    }, requestId);
  }

  async relations(rawId: string, requestId: string): Promise<ServiceResponse<RelationEntry[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.relations };
  }

  async externalLinks(rawId: string, requestId: string): Promise<ServiceResponse<ExternalLink[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.externalLinks };
  }

  async streaming(rawId: string, requestId: string): Promise<ServiceResponse<StreamingEntry[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.streaming };
  }

  private async charactersAndStaff(rawId: string, requestId: string): Promise<ServiceResponse<AnimeCharactersAndStaff>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:anime:${malId}:characters-staff`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, CHARACTERS_STAFF_PARSER_VERSION, () => this.catalog.get<AnimeCharactersAndStaff>(cacheKey), async () => {
      const source = await this.source.getHtml(charactersUrl('anime', malId), ['js-anime-character-table']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = { characters: parseCharacters(source.value, 'anime'), staff: parseStaff(source.value) };
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CHARACTERS_STAFF_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async characters(rawId: string, requestId: string): Promise<ServiceResponse<CharacterRole[]>> {
    const result = await this.charactersAndStaff(rawId, requestId);
    return { ...result, data: result.data.characters };
  }

  async staff(rawId: string, requestId: string): Promise<ServiceResponse<StaffMember[]>> {
    const result = await this.charactersAndStaff(rawId, requestId);
    return { ...result, data: result.data.staff };
  }

  private async perAnimeResource<T>(rawId: string, resource: string, url: string, requiredMarkers: string[], parserVersion: string, parse: (html: string) => T, requestId: string): Promise<ServiceResponse<T>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:anime:${malId}:${resource}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, parserVersion, () => this.catalog.get<T>(cacheKey), async () => {
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
    return this.perAnimeResource(rawId, 'statistics', statisticsUrl('anime', malId), ['Summary Stats'], STATISTICS_PARSER_VERSION, (html) => parseStatistics(html), requestId);
  }

  pictures(rawId: string, requestId: string): Promise<ServiceResponse<Picture[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'pictures', picturesUrl('anime', malId), ['js-picture-gallery'], PICTURES_PARSER_VERSION, parsePictures, requestId);
  }

  news(rawId: string, requestId: string): Promise<ServiceResponse<NewsItem[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'news', newsUrl('anime', malId), ['read more'], NEWS_PARSER_VERSION, parseNews, requestId);
  }

  forum(rawId: string, requestId: string): Promise<ServiceResponse<ForumThread[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'forum', forumUrl('anime', malId), ['data-topic-id'], FORUM_PARSER_VERSION, parseForum, requestId);
  }

  episodes(rawId: string, requestId: string): Promise<ServiceResponse<Episode[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'episodes', episodesUrl(malId), ['episode-list-data'], EPISODES_PARSER_VERSION, parseEpisodes, requestId);
  }

  recommendations(rawId: string, requestId: string): Promise<ServiceResponse<TitleRecommendation[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'recommendations', titleRecommendationsUrl('anime', malId), ['picSurround'], TITLE_RECOMMENDATIONS_PARSER_VERSION, (html) => parseTitleRecommendations(html, 'anime'), requestId);
  }

  reviews(rawId: string, page: number, requestId: string): Promise<ServiceResponse<TitleReview[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:anime:${malId}:reviews:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, TITLE_REVIEWS_PARSER_VERSION, () => this.catalog.get<TitleReview[]>(cacheKey), async () => {
      const source = await this.source.getHtml(titleReviewsUrl('anime', malId, page), ['review-element']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTitleReviews(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TITLE_REVIEWS_PARSER_VERSION);
      return value;
    }, requestId);
  }

  moreInfo(rawId: string, requestId: string): Promise<ServiceResponse<MoreInfo>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'moreinfo', moreInfoUrl('anime', malId), ['id="content"'], MORE_INFO_PARSER_VERSION, parseMoreInfo, requestId);
  }

  videos(rawId: string, requestId: string): Promise<ServiceResponse<TitleVideos>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'videos', videosUrl(malId), ['id="content"'], VIDEOS_PARSER_VERSION, parseTitleVideos, requestId);
  }

  async videosEpisodes(rawId: string, requestId: string): Promise<ServiceResponse<EpisodeVideoEntry[]>> {
    const result = await this.videos(rawId, requestId);
    return { ...result, data: result.data.episodes };
  }

  episodeDetail(rawId: string, rawEpisode: string, requestId: string): Promise<ServiceResponse<EpisodeDetail>> {
    const malId = this.validateMalId(rawId);
    const episode = Number.parseInt(rawEpisode, 10);
    if (!Number.isInteger(episode) || episode <= 0 || String(episode) !== rawEpisode) throw new ServiceError('INVALID_EPISODE', 400, 'Episode number is invalid.');
    return this.perAnimeResource(rawId, `episode:${episode}`, episodeDetailUrl(malId, episode), ['Synopsis'], EPISODE_DETAIL_PARSER_VERSION, (html) => parseEpisodeDetail(html, malId, episode), requestId);
  }

  userUpdates(rawId: string, requestId: string): Promise<ServiceResponse<TitleUserUpdate[]>> {
    const malId = this.validateMalId(rawId);
    return this.perAnimeResource(rawId, 'userupdates', statisticsUrl('anime', malId), ['Summary Stats'], TITLE_USERUPDATES_PARSER_VERSION, parseTitleUserUpdates, requestId);
  }

  async themes(rawId: string, requestId: string): Promise<ServiceResponse<AnimeThemeSongs>> {
    const result = await this.full(rawId, requestId);
    return { ...result, data: result.data.themeSongs };
  }

  async genres(rawFilter: string | undefined, requestId: string): Promise<ServiceResponse<GenreTaxonomyEntry[]>> {
    const filter = parseGenreFilter(rawFilter);
    const result = await withCache({ cache: this.cache, locks: this.locks }, GENRES_CACHE_KEY, this.config.catalogTtlSeconds, GENRE_PARSER_VERSION, () => this.catalog.get<GenreTaxonomyEntry[]>(GENRES_CACHE_KEY), async () => {
      const source = await this.source.getHtml(genreTaxonomyUrl('anime'), ['category-type', 'name="genre[]"']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseGenreTaxonomy(source.value, 'anime');
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(GENRES_CACHE_KEY, value, fetchedAt, GENRE_PARSER_VERSION);
      return value;
    }, requestId);
    return filter ? { ...result, data: result.data.filter((entry) => entry.type === filter) } : result;
  }

  async topAnime(page: number, rawFilter: string | undefined, requestId: string): Promise<ServiceResponse<AnimeListEntry[]>> {
    const filter = parseTopFilter(rawFilter, TOP_ANIME_FILTERS);
    const cacheKey = `catalog:top:anime:page:${page}${filter ? `:${filter}` : ''}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, TOP_ANIME_PARSER_VERSION, () => this.catalog.get<AnimeListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(topAnimeUrl(page, filter), ['ranking-list']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTopAnime(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TOP_ANIME_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async seasonNow(requestId: string): Promise<ServiceResponse<AnimeListEntry[]>> {
    const cacheKey = 'catalog:season:now';
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, SEASON_PARSER_VERSION, () => this.catalog.get<AnimeListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(seasonNowUrl(), ['seasonal-anime']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseSeasonNow(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, SEASON_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async seasonByYear(rawYear: string, rawSeason: string, requestId: string): Promise<ServiceResponse<AnimeListEntry[]>> {
    const year = Number.parseInt(rawYear, 10);
    const season = rawSeason.toLowerCase();
    if (!Number.isInteger(year) || year < 1917 || year > 2100 || String(year) !== rawYear) throw new ServiceError('INVALID_SEASON_YEAR', 400, 'Season year is invalid.');
    if (!VALID_SEASONS.has(season)) throw new ServiceError('INVALID_SEASON', 400, 'Season must be one of winter, spring, summer, fall.');
    const cacheKey = `catalog:season:${year}:${season}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, SEASON_PARSER_VERSION, () => this.catalog.get<AnimeListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(seasonByYearUrl(year, season), ['seasonal-anime']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseSeasonNow(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, SEASON_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async seasonUpcoming(requestId: string): Promise<ServiceResponse<AnimeListEntry[]>> {
    const cacheKey = 'catalog:season:upcoming';
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, SEASON_PARSER_VERSION, () => this.catalog.get<AnimeListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(seasonUpcomingUrl(), ['seasonal-anime']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseSeasonNow(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, SEASON_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async seasonArchive(requestId: string): Promise<ServiceResponse<SeasonArchiveEntry[]>> {
    const cacheKey = 'catalog:season:archive';
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, SEASON_ARCHIVE_PARSER_VERSION, () => this.catalog.get<SeasonArchiveEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(seasonArchiveUrl(), ['season/1']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseSeasonArchive(source.value);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), SEASON_ARCHIVE_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async schedule(rawFilter: string | undefined, requestId: string): Promise<ServiceResponse<ScheduleByDay | AnimeListEntry[]>> {
    const filter = rawFilter?.toLowerCase();
    if (filter !== undefined && !SCHEDULE_DAYS.includes(filter as ScheduleDay)) throw new ServiceError('INVALID_FILTER', 400, `Invalid "filter"; allowed: ${SCHEDULE_DAYS.join(', ')}.`);
    const cacheKey = 'catalog:schedule:by-day';
    const result = await withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, SCHEDULE_PARSER_VERSION, () => this.catalog.get<ScheduleByDay>(cacheKey), async () => {
      const source = await this.source.getHtml(scheduleUrl(), ['seasonal-anime']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseScheduleByDay(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, SCHEDULE_PARSER_VERSION);
      return value;
    }, requestId);
    return filter ? { ...result, data: result.data[filter as ScheduleDay] } : result;
  }
}
