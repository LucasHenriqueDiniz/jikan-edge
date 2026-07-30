import type { Context } from 'hono';
import { ServiceError } from '../services/cacheable';
import { isMissingSchema, SETUP_HINT } from './diagnostics';

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  if (error instanceof ServiceError) return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status as 400);
  // An un-migrated database is a deploy problem, not a request problem: answering INTERNAL_ERROR here
  // sends the operator hunting through code that is working fine.
  if (isMissingSchema(error)) {
    console.error(JSON.stringify({ type: 'setup_error', code: 'DATABASE_NOT_MIGRATED', requestId }));
    return c.json({ error: { code: 'DATABASE_NOT_MIGRATED', message: SETUP_HINT.not_migrated, requestId } }, 503);
  }
  console.error(JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }));
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.', requestId } }, 500);
}
