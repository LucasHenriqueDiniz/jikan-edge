import type { Context } from 'hono';
import { StoreUnavailableError } from '../domain/errors';
import { ParserError } from '../parsers/html';
import { ServiceError } from '../services/cacheable';
import { NO_STORE } from './caching';
import { isMissingSchema, SETUP_HINT } from './diagnostics';

/**
 * What a caller is told to wait after the database stayed unavailable through a request's whole
 * retry window (12 s). The one stall measured end to end lasted 15 s (2026-11-16, 03:07:23–37 UTC),
 * so a caller that already waited the window and then waits this long is past it.
 */
export const DATABASE_RETRY_AFTER_SECONDS = 10;

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  // Never let a failure be cached. A handler may already have set a Cache-Control describing a
  // successful body before throwing, and an upstream outage or a rate-limit answer stored by a CDN
  // would outlive the condition that caused it.
  c.header('Cache-Control', NO_STORE);
  // Nothing on this path was served from the cache, and saying so is the point of the header. Left
  // unset, the middleware filled in `unknown`, which a consumer logging the header reads as "the API
  // does not know" — on the 2026-11-16 incident that sent the investigation toward the cache.
  c.header('X-Cache-Status', 'error');
  if (error instanceof ServiceError)
    return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status);
  // The store retried and gave up: an outage of the database, not a bug and not the caller's doing.
  // 503 with Retry-After so a client can tell it from a 500 and knows when to come back. Logged under
  // its own type so these stay countable apart from `unhandled_error`.
  if (error instanceof StoreUnavailableError) {
    console.error(JSON.stringify({ type: 'database_unavailable', requestId, message: error.message }));
    c.header('Retry-After', String(DATABASE_RETRY_AFTER_SECONDS));
    return c.json(
      {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is temporarily overloaded. Retry after the number of seconds in Retry-After.',
          requestId,
        },
      },
      503,
    );
  }
  // An un-migrated database is a deploy problem, not a request problem: answering INTERNAL_ERROR here
  // sends the operator hunting through code that is working fine.
  if (isMissingSchema(error)) {
    console.error(JSON.stringify({ type: 'setup_error', code: 'DATABASE_NOT_MIGRATED', requestId }));
    return c.json({ error: { code: 'DATABASE_NOT_MIGRATED', message: SETUP_HINT.not_migrated, requestId } }, 503);
  }
  // A parser that cannot read the upstream HTML is an upstream-shaped failure, not a server bug the
  // consumer caused — map it to 502 UPSTREAM_SUSPICIOUS, the same code a suspicious fetch gives,
  // instead of a raw 500. Logged under its own type so a too-strict or outdated parser is still
  // observable rather than hidden behind a generic upstream error.
  if (error instanceof ParserError) {
    console.error(JSON.stringify({ type: 'parser_error', requestId, message: error.message }));
    return c.json(
      { error: { code: 'UPSTREAM_SUSPICIOUS', message: 'Unable to refresh this resource.', requestId } },
      502,
    );
  }
  console.error(
    JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }),
  );
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.', requestId } }, 500);
}
