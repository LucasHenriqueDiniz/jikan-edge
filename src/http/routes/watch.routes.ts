import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import type { WatchService } from '../../services/watch.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 4 routes, moved out of src/app.ts unchanged.
export function registerWatchRoutes(app: App, deps: { watchService: Factory<WatchService> }): void {
  const { watchService } = deps;

  app.get('/v1/watch/episodes', async (c) => {
    try {
      const result = await watchService(c).episodes(false, c.get('requestId'));
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

  app.get('/v1/watch/episodes/popular', async (c) => {
    try {
      const result = await watchService(c).episodes(true, c.get('requestId'));
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

  app.get('/v1/watch/promos', async (c) => {
    try {
      const result = await watchService(c).promos(false, c.get('requestId'));
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

  app.get('/v1/watch/promos/popular', async (c) => {
    try {
      const result = await watchService(c).promos(true, c.get('requestId'));
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
