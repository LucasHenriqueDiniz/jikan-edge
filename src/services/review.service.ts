import type { RuntimeConfig } from '../config/env';
import { REVIEW_PARSER_VERSION, type ReviewEntry } from '../domain/review';
import { parseReviews } from '../parsers/reviews.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { reviewsUrl } from '../source/mal-urls';
import { type ServiceResponse, sourceError, withCache } from './cacheable';

export class ReviewService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private async forType(type: 'anime' | 'manga', page: number, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> {
    // Always suffixed, including page 1. The old special case gave the first page a key of its own
    // shape, which every other paginated route in this codebase does not do — see migration 0011,
    // which renames the four rows it left behind.
    const cacheKey = `catalog:reviews:${type}:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, REVIEW_PARSER_VERSION, () => this.catalog.get<ReviewEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(reviewsUrl(type, page), ['review-element']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseReviews(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, REVIEW_PARSER_VERSION);
      return value;
    }, requestId);
  }

  anime(page: number, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> { return this.forType('anime', page, requestId); }
  manga(page: number, requestId: string): Promise<ServiceResponse<ReviewEntry[]>> { return this.forType('manga', page, requestId); }
}
