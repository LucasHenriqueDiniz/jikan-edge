import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta } from '../../domain/pagination';
import { SEARCH_PAGE_SIZE, TITLE_REVIEWS_PAGE_SIZE, TOP_PAGE_SIZE } from '../../source/mal-urls';
import type { MangaService } from '../../services/manga.service';
import type { SearchService } from '../../services/search.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 17 routes, moved out of src/app.ts unchanged.
export function registerMangaRoutes(
  app: App,
  deps: { mangaService: Factory<MangaService>; searchService: Factory<SearchService> },
): void {
  const { mangaService, searchService } = deps;

  app.get('/v1/manga', async (c) => {
    try {
      const filters = {
        type: c.req.query('type'),
        status: c.req.query('status'),
        score: c.req.query('score'),
        minScore: c.req.query('min_score'),
        genres: c.req.query('genres'),
        magazines: c.req.query('magazines'),
        orderBy: c.req.query('order_by'),
        sort: c.req.query('sort'),
        letter: c.req.query('letter'),
        startDate: c.req.query('start_date'),
        endDate: c.req.query('end_date'),
      };
      const result = await searchService(c).manga(c.req.query('q'), c.get('page'), filters, c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), SEARCH_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id', async (c) => {
    try {
      const result = await mangaService(c).detail(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/full', async (c) => {
    try {
      const result = await mangaService(c).full(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/relations', async (c) => {
    try {
      const result = await mangaService(c).relations(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/external', async (c) => {
    try {
      const result = await mangaService(c).externalLinks(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/characters', async (c) => {
    try {
      const result = await mangaService(c).characters(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/statistics', async (c) => {
    try {
      const result = await mangaService(c).statistics(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/pictures', async (c) => {
    try {
      const result = await mangaService(c).pictures(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/news', async (c) => {
    try {
      const result = await mangaService(c).news(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/forum', async (c) => {
    try {
      const result = await mangaService(c).forum(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/recommendations', async (c) => {
    try {
      const result = await mangaService(c).recommendations(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/reviews', async (c) => {
    try {
      const result = await mangaService(c).reviews(c.req.param('id'), c.get('page'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), TITLE_REVIEWS_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/userupdates', async (c) => {
    try {
      const result = await mangaService(c).userUpdates(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/manga/:id/moreinfo', async (c) => {
    try {
      const result = await mangaService(c).moreInfo(c.req.param('id'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/genres/manga', async (c) => {
    try {
      const result = await mangaService(c).genres(c.req.query('filter'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/top/manga', async (c) => {
    try {
      const result = await mangaService(c).topManga(c.get('page'), c.req.query('filter'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), TOP_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });

  app.get('/v1/magazines', async (c) => {
    try {
      const result = await mangaService(c).magazines(c.req.query('q'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });
}
