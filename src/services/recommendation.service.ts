import type { RuntimeConfig } from '../config/env';
import { RECOMMENDATION_PARSER_VERSION, type RecommendationEntry } from '../domain/recommendation';
import { parseRecommendations } from '../parsers/recommendations.parser';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { recommendationsUrl } from '../source/mal-urls';
import { type CacheDeps, type ServiceResponse, sourceError, type WaitUntil, withCache } from './cacheable';

export class RecommendationService {
  private readonly deps: CacheDeps;
  private readonly catalog: CatalogStore['catalogLists'];
  constructor(
    store: CatalogStore,
    private readonly source: CatalogSource,
    private readonly config: RuntimeConfig,
    waitUntil?: WaitUntil,
  ) {
    this.deps = { cache: store.cacheEntries, locks: store.refreshLeases, waitUntil };
    this.catalog = store.catalogLists;
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
