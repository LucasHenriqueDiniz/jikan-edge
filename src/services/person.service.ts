import type { RuntimeConfig } from '../config/env';
import { PERSON_PARSER_VERSION, type PersonDetail } from '../domain/person';
import { PERSON_FULL_PARSER_VERSION, type PersonFull } from '../domain/person-full';
import { PERSON_MEDIA_PARSER_VERSION, type PublishedManga, type StaffPosition, type VoiceActingRole } from '../domain/person-media';
import { PICTURES_PARSER_VERSION, type Picture } from '../domain/picture';
import { NEWS_PARSER_VERSION, type NewsItem } from '../domain/news';
import { TOP_PEOPLE_PARSER_VERSION, type TopPersonEntry } from '../domain/top-person';
import { parsePersonDetail } from '../parsers/person-detail.parser';
import { parsePersonFull } from '../parsers/person-full.parser';
import { parsePersonAnimeStaff, parsePersonManga, parsePersonVoiceActingRoles } from '../parsers/person-media.parser';
import { parsePictures } from '../parsers/pictures.parser';
import { parseNews } from '../parsers/news.parser';
import { parseTopPeople } from '../parsers/top-people.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { PersonRepository } from '../repositories/person.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { newsUrl, personDetailUrl, picturesUrl, topPeopleUrl } from '../source/mal-urls';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

interface PersonMediaBundle {
  anime: StaffPosition[];
  manga: PublishedManga[];
  voices: VoiceActingRole[];
}

export class PersonService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly people: PersonRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.people = new PersonRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_PERSON_ID', 400, 'Person id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<PersonDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache({ cache: this.cache, locks: this.locks }, `person:${malId}:detail`, this.config.animeTtlSeconds, PERSON_PARSER_VERSION, () => this.people.get(malId), async () => {
      const source = await this.source.getHtml(personDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parsePersonDetail(source.value, malId, fetchedAt);
      await this.people.put(detail, fetchedAt, PERSON_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<PersonFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:person:${malId}:full`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, PERSON_FULL_PARSER_VERSION, () => this.catalog.get<PersonFull>(cacheKey), async () => {
      const source = await this.source.getHtml(personDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const full = parsePersonFull(source.value, malId, fetchedAt);
      await this.catalog.put(cacheKey, full, fetchedAt, PERSON_FULL_PARSER_VERSION);
      return full;
    }, requestId);
  }

  private media(rawId: string, requestId: string): Promise<ServiceResponse<PersonMediaBundle>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:person:${malId}:media`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, PERSON_MEDIA_PARSER_VERSION, () => this.catalog.get<PersonMediaBundle>(cacheKey), async () => {
      const source = await this.source.getHtml(personDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = { anime: parsePersonAnimeStaff(source.value), manga: parsePersonManga(source.value), voices: parsePersonVoiceActingRoles(source.value) };
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, PERSON_MEDIA_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async anime(rawId: string, requestId: string): Promise<ServiceResponse<StaffPosition[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.anime };
  }

  async manga(rawId: string, requestId: string): Promise<ServiceResponse<PublishedManga[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.manga };
  }

  async voices(rawId: string, requestId: string): Promise<ServiceResponse<VoiceActingRole[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.voices };
  }

  pictures(rawId: string, requestId: string): Promise<ServiceResponse<Picture[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:person:${malId}:pictures`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, PICTURES_PARSER_VERSION, () => this.catalog.get<Picture[]>(cacheKey), async () => {
      const source = await this.source.getHtml(picturesUrl('people', malId), ['js-picture-gallery']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parsePictures(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, PICTURES_PARSER_VERSION);
      return value;
    }, requestId);
  }

  news(rawId: string, requestId: string): Promise<ServiceResponse<NewsItem[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:person:${malId}:news`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, NEWS_PARSER_VERSION, () => this.catalog.get<NewsItem[]>(cacheKey), async () => {
      const source = await this.source.getHtml(newsUrl('people', malId), ['read more']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseNews(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, NEWS_PARSER_VERSION);
      return value;
    }, requestId);
  }

  topPeople(rawPage: string | undefined, requestId: string): Promise<ServiceResponse<TopPersonEntry[]>> {
    const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);
    const cacheKey = `catalog:top:people:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, TOP_PEOPLE_PARSER_VERSION, () => this.catalog.get<TopPersonEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(topPeopleUrl(page), ['ranking-list']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTopPeople(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TOP_PEOPLE_PARSER_VERSION);
      return value;
    }, requestId);
  }
}
