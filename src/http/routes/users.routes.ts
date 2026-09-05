import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta, parseLimitParam } from '../../domain/pagination';
import { USER_SEARCH_PAGE_SIZE } from '../../source/mal-urls';
import type { UserService } from '../../services/user.service';
import type { SearchService } from '../../services/search.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 12 routes, moved out of src/app.ts unchanged.
export function registerUsersRoutes(
  app: App,
  deps: { service: Factory<UserService>; searchService: Factory<SearchService> },
): void {
  const { service, searchService } = deps;
  app.get('/v1/users/:username', async (c) => {
    try {
      const result = await service(c).profile(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/statistics', async (c) => {
    try {
      const result = await service(c).statistics(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/favorites', async (c) => {
    try {
      const result = await service(c).favoritesFor(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/userupdates', async (c) => {
    try {
      const result = await service(c).userUpdates(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/full', async (c) => {
    try {
      const result = await service(c).fullProfile(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/about', async (c) => {
    try {
      const result = await service(c).about(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/friends', async (c) => {
    try {
      const result = await service(c).friends(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/clubs', async (c) => {
    try {
      const result = await service(c).clubs(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/reviews', async (c) => {
    try {
      const result = await service(c).reviews(c.req.param('username'), c.get('requestId'));
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

  app.get('/v1/users/:username/recommendations', async (c) => {
    try {
      const result = await service(c).recommendations(c.req.param('username'), c.get('requestId'));
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

  for (const mediaType of ['anime', 'manga'] as const)
    app.get(`/v1/users/:username/${mediaType}list`, async (c) => {
      try {
        const page = c.get('page');
        const limit = parseLimitParam(c.req.query('limit'));
        const result = await service(c).mediaList(c.req.param('username'), mediaType, c.get('requestId'), page, limit);
        cacheHeader(c, result);
        // The only routes with a real `total`: these page over D1, not over a MyAnimeList page.
        return c.json(
          success(result.data.entries, {
            cached: result.cached,
            stale: result.stale,
            refreshFailed: result.refreshFailed,
            fetchedAt: result.fetchedAt,
            pagination: paginationMeta(page, limit, result.data.entries.length, result.data.total),
          }),
        );
      } catch (error) {
        return errorResponse(c, error, c.get('requestId'));
      }
    });

  app.get('/v1/users', async (c) => {
    try {
      const result = await searchService(c).users(c.req.query('q'), c.get('page'), c.get('requestId'));
      cacheHeader(c, result);
      return c.json(
        success(result.data, {
          cached: result.cached,
          stale: result.stale,
          refreshFailed: result.refreshFailed,
          fetchedAt: result.fetchedAt,
          pagination: paginationMeta(c.get('page'), USER_SEARCH_PAGE_SIZE, result.data.length),
        }),
      );
    } catch (error) {
      return errorResponse(c, error, c.get('requestId'));
    }
  });
}
