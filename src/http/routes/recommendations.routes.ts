import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta } from '../../domain/pagination';
import { RECOMMENDATIONS_PAGE_SIZE } from '../../source/mal-urls';
import type { RecommendationService } from '../../services/recommendation.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 2 routes, moved out of src/app.ts unchanged.
export function registerRecommendationsRoutes(
  app: App,
  deps: { recommendationService: Factory<RecommendationService> },
): void {
  const { recommendationService } = deps;
  app.get('/v1/recommendations/anime', async (c) => {
    try {
      const result = await recommendationService(c).anime(c.get('page'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), RECOMMENDATIONS_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/recommendations/manga', async (c) => {
    try {
      const result = await recommendationService(c).manga(c.get('page'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), RECOMMENDATIONS_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });
}
