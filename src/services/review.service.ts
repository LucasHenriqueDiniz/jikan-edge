import type { RuntimeConfig } from '../config/env';
import { REVIEW_PARSER_VERSION, type ReviewEntry } from '../domain/review';
import { parseReviews } from '../parsers/reviews.parser';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { reviewsUrl } from '../source/mal-urls';
import {
  type CacheDeps,
  isPastLastPage,
  type ServiceResponse,
  sourceError,
  type WaitUntil,
  withCache,
} from './cacheable';
import type { ReviewFilter } from './review-filter';

export class ReviewService {
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
    filter: ReviewFilter,
    requestId: string,
  ): Promise<ServiceResponse<ReviewEntry[]>> {
    // Always suffixed, including page 1. The old special case gave the first page a key of its own
    // shape, which every other paginated route in this codebase does not do — see migration 0011,
    // which renames the four rows it left behind.
    const cacheKey = `catalog:reviews:${type}:page:${page}${filter.key}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      REVIEW_PARSER_VERSION,
      () => this.catalog.get<ReviewEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(reviewsUrl(type, page, filter.params), ['review-element']);
        if (isPastLastPage(source, page)) {
          await this.catalog.put(cacheKey, [], new Date().toISOString(), REVIEW_PARSER_VERSION);
          return [];
        }
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseReviews(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, REVIEW_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  anime(page: number, filter: ReviewFilter, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> {
    return this.forType('anime', page, filter, requestId);
  }
  manga(page: number, filter: ReviewFilter, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> {
    return this.forType('manga', page, filter, requestId);
  }
}
