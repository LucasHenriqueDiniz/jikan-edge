import type { App } from '../app-context';
import { cacheHeader } from '../app-context';
import { configFrom } from '../../config/env';
import { errorResponse } from '../../http/errors';
import { isStale, NO_STORE } from '../../http/caching';
import { success } from '../../http/response';
import { RandomService, type RandomKind } from '../../services/random.service';
import type { UserService } from '../../services/user.service';

import type { AppContext } from '../app-context';
type Factory<T> = (c: AppContext) => T;

// 2 routes, moved out of src/app.ts unchanged.
export function registerRandomRoutes(app: App, deps: { service: Factory<UserService> }): void {
  const { service } = deps;

  // Every random pick is explicitly uncacheable: a shared cache that stored one would pin a single
  // entity and serve it to everyone for the rest of its lifetime, which is the opposite of what the
  // route promises. That applies to `/v1/random/users` too — it reads a real profile through
  // withCache, so it used to advertise that profile's remaining TTL and was the one pick a CDN could
  // freeze.
  //
  // These four are also the only reads that bypass withCache, so `stale` is worked out here from the
  // stored row's own timestamp instead of being left out. They report the same four meta fields as
  // the rest of the API rather than a lone `requestId` no other successful response carries.
  for (const kind of ['anime', 'manga', 'characters', 'people'] as RandomKind[])
    app.get(`/v1/random/${kind}`, async (c) => {
      try {
        const picked = await new RandomService(c.env.DB).pick(kind);
        // `local` rather than hit/miss: nothing upstream was consulted and nothing will be refreshed.
        c.header('X-Cache-Status', 'local');
        c.header('Cache-Control', NO_STORE);
        return c.json(
          success(picked.data, {
            cached: true,
            stale: isStale(picked.fetchedAt, configFrom(c.env).catalogTtlSeconds),
            refreshFailed: false,
            fetchedAt: picked.fetchedAt,
          }),
        );
      } catch (error) {
        return errorResponse(c, error, c.get('requestId'));
      }
    });

  app.get('/v1/random/users', async (c) => {
    try {
      const picked = await new RandomService(c.env.DB).pickUser();
      const result = await service(c).profile(picked.username, c.get('requestId'));
      cacheHeader(c, result);
      c.header('Cache-Control', NO_STORE);
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
