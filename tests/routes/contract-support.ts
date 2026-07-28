import { expect } from 'vitest';
import type { Hono } from 'hono';

/**
 * Shared scaffolding for the per-group Jikan contract tests.
 *
 * Mocks themselves cannot live here — `vi.mock` is hoisted per module, so each group file
 * declares its own and imports `src/app` afterwards.
 */

/** Wraps a payload the way every service returns it, so handlers see a cache-hit response. */
export const served = <T>(data: T) => ({
  data,
  cached: true,
  stale: false,
  refreshFailed: false,
  fetchedAt: '2026-07-28T00:00:00.000Z',
});

/** The mocked services ignore it, but handlers still read c.env.DB to construct them. */
export const env = { DB: {} as D1Database, WORKER_VERSION: 'test' };

export function requester(app: Hono<any>) {
  return async function get(path: string) {
    const response = await app.request(`http://localhost${path}`, {}, env);
    return { response, body: (await response.json()) as Record<string, any> };
  };
}

/**
 * The regression net for a 92-route rename: nothing under `data` or `pagination` may keep a
 * camelCase key. `meta` is ours and is deliberately exempt.
 */
export function expectNoCamelCase(value: unknown, path = 'data'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectNoCamelCase(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(/[a-z][A-Z]/.test(key), `camelCase key "${key}" at ${path}`).toBe(false);
    expectNoCamelCase(child, `${path}.${key}`);
  }
}

/**
 * Asserts the full envelope of a list route: Jikan pagination shape, no camelCase anywhere,
 * and our `meta` still riding along.
 */
export function expectListEnvelope(body: Record<string, any>): void {
  expectNoCamelCase(body.data);
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.meta).toMatchObject({ cached: true, stale: false });
  if (body.pagination) {
    expectNoCamelCase(body.pagination, 'pagination');
    expect(body.pagination).toHaveProperty('has_next_page');
    expect(body.pagination).toHaveProperty('current_page');
    expect(body.pagination.items).toHaveProperty('per_page');
  }
}
