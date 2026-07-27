import type { Context } from 'hono';
import { ServiceError } from '../services/cacheable';

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  if (error instanceof ServiceError) return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status as 400);
  console.error(JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }));
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.', requestId } }, 500);
}
