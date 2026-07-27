import type { RuntimeConfig } from '../config/env';
import { RECOMMENDATION_PARSER_VERSION, type RecommendationEntry } from '../domain/recommendation';
import { parseRecommendations } from '../parsers/recommendations.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { recommendationsUrl } from '../source/mal-urls';
import { type ServiceResponse, sourceError, withCache } from './cacheable';

export class RecommendationService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private async forType(type: 'anime' | 'manga', rawPage: string | undefined, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> {
    const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);
    const cacheKey = page > 1 ? `catalog:recommendations:${type}:page:${page}` : `catalog:recommendations:${type}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, RECOMMENDATION_PARSER_VERSION, () => this.catalog.get<RecommendationEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(recommendationsUrl(type, page), ['recommendations-user-recs-text']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseRecommendations(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, RECOMMENDATION_PARSER_VERSION);
      return value;
    }, requestId);
  }

  anime(rawPage: string | undefined, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> { return this.forType('anime', rawPage, requestId); }
  manga(rawPage: string | undefined, requestId: string): Promise<ServiceResponse<RecommendationEntry[]>> { return this.forType('manga', rawPage, requestId); }
}
