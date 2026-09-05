import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { errorResponse } from '../../http/errors';
import { success } from '../../http/response';
import type { ProducerService } from '../../services/producer.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 4 routes, moved out of src/app.ts unchanged.
export function registerProducersRoutes(app: App, deps: { producerService: Factory<ProducerService> }): void {
  const { producerService } = deps;

  app.get('/v1/producers', async (c) => {
    try {
      const result = await producerService(c).list(c.req.query('q'), c.get('requestId'));
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

  app.get('/v1/producers/:id', async (c) => {
    try {
      const result = await producerService(c).detail(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/producers/:id/full', async (c) => {
    try {
      const result = await producerService(c).full(c.req.param('id'), c.get('requestId'));
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

  app.get('/v1/producers/:id/external', async (c) => {
    try {
      const result = await producerService(c).external(c.req.param('id'), c.get('requestId'));
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
