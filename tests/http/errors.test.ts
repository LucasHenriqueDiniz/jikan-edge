import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { errorResponse } from '../../src/http/errors';
import { NO_STORE } from '../../src/http/caching';
import { ServiceError } from '../../src/services/cacheable';
import { ParserError } from '../../src/parsers/html';
import { StoreUnavailableError } from '../../src/domain/errors';

// `ServiceError.status` is a union of literals rather than `number`, and it is handed straight to
// Hono's `c.json`. Adding a status to that union is only half the job — this checks the other half,
// that the status survives the trip out and is not silently coerced to 500.
async function respond(error: unknown): Promise<Response> {
  const app = new Hono();
  app.get('/x', (c) => errorResponse(c, error, 'req-1'));
  return app.request('http://localhost/x');
}

describe('errorResponse', () => {
  it('carries every status a ServiceError can hold through to the client', async () => {
    const statuses = [400, 403, 404, 429, 501, 502, 503, 504, 507] as const;
    for (const status of statuses) {
      const response = await respond(new ServiceError('SOME_CODE', status, 'message'));
      expect(response.status, String(status)).toBe(status);
    }
  });

  it('answers 507 PAYLOAD_TOO_LARGE with the code and request id in the body', async () => {
    const response = await respond(
      new ServiceError('PAYLOAD_TOO_LARGE', 507, 'This resource is larger than this deployment can store.'),
    );
    expect(response.status).toBe(507);
    expect(await response.json()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'This resource is larger than this deployment can store.',
        requestId: 'req-1',
      },
    });
  });

  it('never lets a failure be cached, whatever it was', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const error of [new ServiceError('PAYLOAD_TOO_LARGE', 507, 'm'), new Error('something unexpected')]) {
      expect((await respond(error)).headers.get('cache-control')).toBe(NO_STORE);
    }
    logged.mockRestore();
  });

  // A parser that cannot read the upstream HTML is an upstream-shaped failure, not a server bug from
  // the consumer's side — so it maps to 502 UPSTREAM_SUSPICIOUS, the same code a suspicious fetch
  // gives, rather than a raw 500. Without this, a too-strict or outdated parser leaked a 500 on the
  // detail routes (e.g. /v1/manga/4632, whose h1 embeds an English title the parser could not read).
  it('maps a ParserError to 502 UPSTREAM_SUSPICIOUS, not 500', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await respond(new ParserError('invalid_manga_detail'));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: 'UPSTREAM_SUSPICIOUS', message: 'Unable to refresh this resource.', requestId: 'req-1' },
    });
    logged.mockRestore();
  });

  it('answers 503 DATABASE_UNAVAILABLE with Retry-After when the store gave up retrying', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('D1_ERROR: D1 DB is overloaded. Requests queued for too long.');
    const response = await respond(new StoreUnavailableError(cause.message, { cause }));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('10');
    expect(await response.json()).toEqual({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is temporarily overloaded. Retry after the number of seconds in Retry-After.',
        requestId: 'req-1',
      },
    });
    expect(logged).toHaveBeenCalledWith(
      JSON.stringify({ type: 'database_unavailable', requestId: 'req-1', message: cause.message }),
    );
    logged.mockRestore();
  });

  // The mapping is by type, not by message: the retry lives in the store adapter, and a D1 overload
  // that reached this function without going through it would be a wiring bug worth a 500.
  it('keeps a raw D1 overload that never went through the store as a 500', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await respond(new Error('D1_ERROR: D1 DB is overloaded. Requests queued for too long.'));
    expect(response.status).toBe(500);
    logged.mockRestore();
  });

  it('labels every error response as not served from the cache, instead of leaving it unknown', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const error of [
      new ServiceError('UPSTREAM_TIMEOUT', 504, 'm'),
      new StoreUnavailableError('m'),
      new ParserError('x'),
      new Error('something unexpected'),
    ])
      expect((await respond(error)).headers.get('x-cache-status')).toBe('error');
    logged.mockRestore();
  });

  it('still turns an unrecognised failure into 500, not into a capacity limit', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await respond(new Error('D1_ERROR: no such column: x'));
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
    logged.mockRestore();
  });
});
