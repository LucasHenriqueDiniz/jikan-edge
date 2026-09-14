import type { Context } from 'hono';
import { ParserError } from '../parsers/html';
import { ServiceError } from '../services/cacheable';
import { NO_STORE } from './caching';
import { isMissingSchema, SETUP_HINT } from './diagnostics';

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  // Never let a failure be cached. A handler may already have set a Cache-Control describing a
  // successful body before throwing, and an upstream outage or a rate-limit answer stored by a CDN
  // would outlive the condition that caused it.
  c.header('Cache-Control', NO_STORE);
  if (error instanceof ServiceError)
    return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status);
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
    return c.json({ error: { code: 'UPSTREAM_SUSPICIOUS', message: 'Unable to refresh this resource.', requestId } }, 502);
  }
  console.error(
    JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }),
  );
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.', requestId } }, 500);
}
