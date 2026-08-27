import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { errorResponse } from '../../src/http/errors';
import { NO_STORE } from '../../src/http/caching';
import { ServiceError } from '../../src/services/cacheable';

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
    const response = await respond(new ServiceError('PAYLOAD_TOO_LARGE', 507, 'This resource is larger than this deployment can store.'));
    expect(response.status).toBe(507);
    expect(await response.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'This resource is larger than this deployment can store.', requestId: 'req-1' },
    });
  });

  it('never lets a failure be cached, whatever it was', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const error of [new ServiceError('PAYLOAD_TOO_LARGE', 507, 'm'), new Error('something unexpected')]) {
      expect((await respond(error)).headers.get('cache-control')).toBe(NO_STORE);
    }
    logged.mockRestore();
  });

  it('still turns an unrecognised failure into 500, not into a capacity limit', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await respond(new Error('D1_ERROR: no such column: x'));
    expect(response.status).toBe(500);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
    logged.mockRestore();
  });
});
