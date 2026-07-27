import type { RuntimeConfig } from '../config/env';
import type { ExternalLink } from '../domain/anime';
import { PRODUCER_PARSER_VERSION, type ProducerDetail } from '../domain/producer';
import { PRODUCER_FULL_PARSER_VERSION, type ProducerFull } from '../domain/producer-full';
import { parseProducerDetail } from '../parsers/producer-detail.parser';
import { parseProducerFull } from '../parsers/producer-full.parser';
import { PRODUCER_LIST_PARSER_VERSION, type ProducerListEntry } from '../domain/producer-list';
import { parseProducersList } from '../parsers/producers-list.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { ProducerRepository } from '../repositories/producer.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { producerDetailUrl, producersIndexUrl } from '../source/mal-urls';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

export class ProducerService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly producers: ProducerRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.producers = new ProducerRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_PRODUCER_ID', 400, 'Producer id is invalid.');
    return malId;
  }

  async list(rawQuery: string | undefined, requestId: string): Promise<ServiceResponse<ProducerListEntry[]>> {
    const cacheKey = 'catalog:producers';
    const result = await withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, PRODUCER_LIST_PARSER_VERSION, () => this.catalog.get<ProducerListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(producersIndexUrl(), ['genre-name-link']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseProducersList(source.value);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), PRODUCER_LIST_PARSER_VERSION);
      return value;
    }, requestId);
    const query = (rawQuery ?? '').trim().toLowerCase();
    return query ? { ...result, data: result.data.filter((entry) => entry.name.toLowerCase().includes(query)) } : result;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<ProducerDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache({ cache: this.cache, locks: this.locks }, `producer:${malId}:detail`, this.config.animeTtlSeconds, PRODUCER_PARSER_VERSION, () => this.producers.get(malId), async () => {
      const source = await this.source.getHtml(producerDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parseProducerDetail(source.value, malId, fetchedAt);
      await this.producers.put(detail, fetchedAt, PRODUCER_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<ProducerFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:producer:${malId}:full`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, PRODUCER_FULL_PARSER_VERSION, () => this.catalog.get<ProducerFull>(cacheKey), async () => {
      const source = await this.source.getHtml(producerDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const full = parseProducerFull(source.value, malId, fetchedAt);
      await this.catalog.put(cacheKey, full, fetchedAt, PRODUCER_FULL_PARSER_VERSION);
      return full;
    }, requestId);
  }

  async external(rawId: string, requestId: string): Promise<ServiceResponse<ExternalLink[]>> {
    const result = await this.full(rawId, requestId);
    return { ...result, data: result.data.external };
  }
}
