import type { Context, MiddlewareHandler } from 'hono';
import { parsePageParam } from '../domain/pagination';
import { ServiceError } from '../services/cacheable';
import { errorResponse } from './errors';
import { QUERY_CONTRACT, UNSUPPORTED_PARAMS } from './query-contract';

// One middleware per route pattern, registered from QUERY_CONTRACT before the handlers.
//
// It has to be per-pattern rather than one catch-all on `/v1/*`: Hono composes middleware in
// registration order instead of letting a specific one override a general one, so a blanket guard
// would reject `?q=` before the route that accepts it ever ran.
export function queryGuard(allowed: readonly string[]): MiddlewareHandler {
  const permitted = new Set(allowed);
  return async (c, next) => {
    try {
      for (const name of new URL(c.req.url).searchParams.keys()) {
        if (permitted.has(name)) continue;
        const reason = UNSUPPORTED_PARAMS[name];
        if (reason) throw new ServiceError('UNSUPPORTED_PARAMETER', 400, `"${name}" is not supported on this route. ${reason}`);
        throw new ServiceError(
          'UNKNOWN_PARAMETER',
          400,
          allowed.length === 0
            ? `"${name}" is not a parameter of this route, which takes none.`
            : `"${name}" is not a parameter of this route. Accepted: ${allowed.join(', ')}.`,
        );
      }
      // Validated once, here, instead of seventeen times inside the services.
      if (permitted.has('page')) c.set('page', parsePageParam(c.req.query('page')));
    } catch (error) {
      return errorResponse(c as Context, error, c.get('requestId') as string);
    }
    await next();
  };
}

export function registerQueryGuards(app: { use: (path: string, handler: MiddlewareHandler) => unknown }): void {
  for (const [path, allowed] of Object.entries(QUERY_CONTRACT)) app.use(path, queryGuard(allowed));
}
