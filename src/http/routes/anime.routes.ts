import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta } from '../../domain/pagination';
import { SEARCH_PAGE_SIZE, TITLE_REVIEWS_PAGE_SIZE, TOP_PAGE_SIZE } from '../../source/mal-urls';
import type { AnimeService } from '../../services/anime.service';
import type { SearchService } from '../../services/search.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 23 routes, moved out of src/app.ts unchanged.
export function registerAnimeRoutes(
  app: App,
  deps: { animeService: Factory<AnimeService>; searchService: Factory<SearchService> },
): void {
  const { animeService, searchService } = deps;

  app.get('/v1/anime', async (c) => {
    try {
      const filters = {
        type: c.req.query('type'),
        status: c.req.query('status'),
        rating: c.req.query('rating'),
        score: c.req.query('score'),
        minScore: c.req.query('min_score'),
        genres: c.req.query('genres'),
        orderBy: c.req.query('order_by'),
        sort: c.req.query('sort'),
        letter: c.req.query('letter'),
        startDate: c.req.query('start_date'),
        endDate: c.req.query('end_date'),
      };
      const result = await searchService(c).anime(c.req.query('q'), c.get('page'), filters, c.get('requestId'));
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

  app.get('/v1/anime/:id', async (c) => {
    try {
      const result = await animeService(c).detail(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/full', async (c) => {
    try {
      const result = await animeService(c).full(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/relations', async (c) => {
    try {
      const result = await animeService(c).relations(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/external', async (c) => {
    try {
      const result = await animeService(c).externalLinks(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/streaming', async (c) => {
    try {
      const result = await animeService(c).streaming(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/characters', async (c) => {
    try {
      const result = await animeService(c).characters(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/staff', async (c) => {
    try {
      const result = await animeService(c).staff(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/statistics', async (c) => {
    try {
      const result = await animeService(c).statistics(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/pictures', async (c) => {
    try {
      const result = await animeService(c).pictures(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/news', async (c) => {
    try {
      const result = await animeService(c).news(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/forum', async (c) => {
    try {
      const result = await animeService(c).forum(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/episodes', async (c) => {
    try {
      const result = await animeService(c).episodes(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/recommendations', async (c) => {
    try {
      const result = await animeService(c).recommendations(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/reviews', async (c) => {
    try {
      const result = await animeService(c).reviews(c.req.param('id'), c.get('page'), c.get('requestId'));
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

  app.get('/v1/anime/:id/videos', async (c) => {
    try {
      const result = await animeService(c).videos(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/videos/episodes', async (c) => {
    try {
      const result = await animeService(c).videosEpisodes(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/episodes/:episode', async (c) => {
    try {
      const result = await animeService(c).episodeDetail(c.req.param('id'), c.req.param('episode'), c.get('requestId'));
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

  app.get('/v1/anime/:id/userupdates', async (c) => {
    try {
      const result = await animeService(c).userUpdates(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/themes', async (c) => {
    try {
      const result = await animeService(c).themes(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/anime/:id/moreinfo', async (c) => {
    try {
      const result = await animeService(c).moreInfo(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/genres/anime', async (c) => {
    try {
      const result = await animeService(c).genres(c.req.query('filter'), c.get('requestId'));
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

  app.get('/v1/top/anime', async (c) => {
    try {
      const result = await animeService(c).topAnime(c.get('page'), c.req.query('filter'), c.get('requestId'));
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
}
