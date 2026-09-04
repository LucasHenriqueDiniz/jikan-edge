import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { paginationMeta } from '../../domain/pagination';
import { SEARCH_PAGE_SIZE, TOP_PAGE_SIZE } from '../../source/mal-urls';
import type { CharacterService } from '../../services/character.service';
import type { SearchService } from '../../services/search.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 8 routes, moved out of src/app.ts unchanged.
export function registerCharactersRoutes(
  app: App,
  deps: { characterService: Factory<CharacterService>; searchService: Factory<SearchService> },
): void {
  const { characterService, searchService } = deps;
  app.get('/v1/top/characters', async (c) => {
    try {
      const result = await characterService(c).topCharacters(c.get('page'), c.get('requestId'));
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

  app.get('/v1/characters', async (c) => {
    try {
      const result = await searchService(c).characters(c.req.query('q'), c.get('page'), c.get('requestId'));
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

  app.get('/v1/characters/:id', async (c) => {
    try {
      const result = await characterService(c).detail(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/characters/:id/full', async (c) => {
    try {
      const result = await characterService(c).full(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/characters/:id/anime', async (c) => {
    try {
      const result = await characterService(c).anime(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/characters/:id/manga', async (c) => {
    try {
      const result = await characterService(c).manga(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/characters/:id/voices', async (c) => {
    try {
      const result = await characterService(c).voices(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/characters/:id/pictures', async (c) => {
    try {
      const result = await characterService(c).pictures(c.req.param('id'), c.get('requestId'));
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
