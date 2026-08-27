import type { Context } from 'hono';
import { ServiceError } from '../services/cacheable';
import { NO_STORE } from './caching';
import { isMissingSchema, SETUP_HINT } from './diagnostics';

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  // Never let a failure be cached. A handler may already have set a Cache-Control describing a
  // successful body before throwing, and an upstream outage or a rate-limit answer stored by a CDN
  // would outlive the condition that caused it.
  c.header('Cache-Control', NO_STORE);
  if (error instanceof ServiceError) return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status);
  // An un-migrated database is a deploy problem, not a request problem: answering INTERNAL_ERROR here
  // sends the operator hunting through code that is working fine.
  if (isMissingSchema(error)) {
    console.error(JSON.stringify({ type: 'setup_error', code: 'DATABASE_NOT_MIGRATED', requestId }));
    return c.json({ error: { code: 'DATABASE_NOT_MIGRATED', message: SETUP_HINT.not_migrated, requestId } }, 503);
  }
  console.error(JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }));
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.', requestId } }, 500);
}
