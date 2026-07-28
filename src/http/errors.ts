import type { Context } from 'hono';
import { ServiceError } from '../services/cacheable';

/**
 * Jikan reports errors as a flat `{status, type, message, error}` object rather than a nested
 * one. We keep our own code in `error` — it's more specific than Jikan's exception names and is
 * what our logs and `docs/routes.md` talk about — and keep `requestId` as an extra key.
 */
export interface JikanError {
  status: number;
  type: string;
  message: string;
  error: string;
  requestId: string;
}

const JIKAN_ERROR: Record<string, { type: string; message: string }> = {
  NOT_FOUND: { type: 'BadResponseException', message: 'Resource does not exist' },
  NO_LOCAL_ENTRIES: { type: 'BadResponseException', message: 'Resource does not exist' },
  PRIVATE_PROFILE: { type: 'BadResponseException', message: 'Resource is private' },
  RATE_LIMITED: { type: 'RateLimitException', message: 'Too Many Requests' },
  UPSTREAM_RATE_LIMITED: { type: 'RateLimitException', message: 'Too Many Requests' },
  INVALID_FILTER: { type: 'BadRequestException', message: '' },
  UPSTREAM_SUSPICIOUS: { type: 'BadResponseException', message: 'Upstream returned an unexpected document' },
  UPSTREAM_UNAVAILABLE: { type: 'BadResponseException', message: 'Upstream unavailable' },
  REFRESH_IN_PROGRESS: { type: 'BadResponseException', message: 'Resource refresh in progress' },
  UPSTREAM_TIMEOUT: { type: 'BadResponseException', message: 'Upstream timeout' },
  INTERNAL_ERROR: { type: 'Exception', message: 'Unexpected server error' },
};

export function jikanError(code: string, status: number, requestId: string, fallbackMessage: string): JikanError {
  const mapped = JIKAN_ERROR[code];
  return {
    status,
    type: mapped?.type ?? 'Exception',
    // An empty mapped message means "the service's own message is the useful one" (bad filters
    // name the offending parameter); anything else would throw that detail away.
    message: mapped?.message || fallbackMessage,
    error: code,
    requestId,
  };
}

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  if (error instanceof ServiceError) {
    return c.json(jikanError(error.code, error.status, requestId, error.message), error.status as 400);
  }
  console.error(JSON.stringify({ type: 'unhandled_error', requestId, message: error instanceof Error ? error.message : 'unknown' }));
  return c.json(jikanError('INTERNAL_ERROR', 500, requestId, 'Unexpected server error'), 500);
}
