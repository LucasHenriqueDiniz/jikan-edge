import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta } from '../../domain/pagination';
import { SEARCH_PAGE_SIZE, TOP_PAGE_SIZE } from '../../source/mal-urls';
import type { PersonService } from '../../services/person.service';
import type { SearchService } from '../../services/search.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 9 routes, moved out of src/app.ts unchanged.
export function registerPeopleRoutes(
  app: App,
  deps: { personService: Factory<PersonService>; searchService: Factory<SearchService> },
): void {
  const { personService, searchService } = deps;
  app.get('/v1/top/people', async (c) => {
    try {
      const result = await personService(c).topPeople(c.get('page'), c.get('requestId'));
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

  app.get('/v1/people', async (c) => {
    try {
      const result = await searchService(c).people(c.req.query('q'), c.get('page'), c.get('requestId'));
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

  app.get('/v1/people/:id', async (c) => {
    try {
      const result = await personService(c).detail(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/full', async (c) => {
    try {
      const result = await personService(c).full(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/anime', async (c) => {
    try {
      const result = await personService(c).anime(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/manga', async (c) => {
    try {
      const result = await personService(c).manga(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/voices', async (c) => {
    try {
      const result = await personService(c).voices(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/pictures', async (c) => {
    try {
      const result = await personService(c).pictures(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/people/:id/news', async (c) => {
    try {
      const result = await personService(c).news(c.req.param('id'), c.get('requestId'));
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
