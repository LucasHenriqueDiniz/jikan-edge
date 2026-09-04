import type { RuntimeConfig } from '../config/env';
import { RECOMMENDATION_PARSER_VERSION, type RecommendationEntry } from '../domain/recommendation';
import { parseRecommendations } from '../parsers/recommendations.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import { MalClient } from '../source/mal-client';
import { recommendationsUrl } from '../source/mal-urls';
import { type CacheDeps, type ServiceResponse, sourceError, type WaitUntil, withCache } from './cacheable';

export class RecommendationService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly deps: CacheDeps;
  private readonly catalog: CatalogListRepository;
  private readonly source: CatalogSource;
  constructor(
    db: D1Database,
    private readonly config: RuntimeConfig,
    source?: CatalogSource,
    waitUntil?: WaitUntil,
  ) {
    this.cache = new CacheRepository(db);
    this.locks = new RefreshLockRepository(db);
    this.deps = { cache: this.cache, locks: this.locks, waitUntil };
    this.catalog = new CatalogListRepository(db);
    this.source = source ?? new MalClient(config);
  }

  private async forType(
    type: 'anime' | 'manga',
    page: number,
    requestId: string,
  ): Promise<ServiceResponse<RecommendationEntry[]>> {
    // Always suffixed, including page 1 — see the note in review.service.ts and migration 0011.
    const cacheKey = `catalog:recommendations:${type}:page:${page}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      RECOMMENDATION_PARSER_VERSION,
      () => this.catalog.get<RecommendationEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(recommendationsUrl(type, page), ['recommendations-user-recs-text']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseRecommendations(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, RECOMMENDATION_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  anime(page: number, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> {
    return this.forType('anime', page, requestId);
  }
  manga(page: number, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> {
    return this.forType('manga', page, requestId);
  }
}
