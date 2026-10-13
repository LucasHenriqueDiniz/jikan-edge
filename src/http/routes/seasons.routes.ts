import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import { ServiceError } from '../../services/cacheable';
import type { AnimeService } from '../../services/anime.service';

// `continuing` is a flag in Jikan (`?continuing` includes them); here they are included by default,
// so the flag only matters as `false`. Anything but true/false/empty is refused rather than read as one.
function continuingParam(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  throw new ServiceError('INVALID_FILTER', 400, '"continuing" must be "true" or "false".');
}

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 5 routes, moved out of src/app.ts unchanged.
export function registerSeasonsRoutes(app: App, deps: { animeService: Factory<AnimeService> }): void {
  const { animeService } = deps;
  app.get('/v1/seasons', async (c) => {
    try {
      const result = await animeService(c).seasonArchive(c.get('requestId'));
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

  app.get('/v1/seasons/now', async (c) => {
    try {
      const result = await animeService(c).seasonNow(continuingParam(c.req.query('continuing')), c.get('requestId'));
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

  app.get('/v1/seasons/upcoming', async (c) => {
    try {
      const result = await animeService(c).seasonUpcoming(c.get('requestId'));
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

  app.get('/v1/seasons/:year/:season', async (c) => {
    try {
      const result = await animeService(c).seasonByYear(
        c.req.param('year'),
        c.req.param('season'),
        continuingParam(c.req.query('continuing')),
        c.get('requestId'),
      );
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

  app.get('/v1/schedules', async (c) => {
    try {
      const result = await animeService(c).schedule(c.req.query('filter'), c.get('requestId'));
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
