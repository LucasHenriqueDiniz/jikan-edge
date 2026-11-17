import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { flakyDatabase, stubDatabase } from '../helpers/stub-database';

// Through the real app, so these fail if the store stops wrapping the binding — the unit tests of the
// retry cannot see that. Fake timers because the production window is 12 s of real waiting.
//
// The incident (2026-11-16, requestId 6348a36f-…): the WeebProfile cron asked for these two routes,
// D1 refused the first statement as overloaded in 9 ms, and the card died on a 500 INTERNAL_ERROR with
// `X-Cache-Status: unknown`, while a 24-hour-old copy of the data sat in the same database.
describe('a D1 that is overloaded', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function request(path: string, DB: D1Database) {
    const pending = app.request(`http://localhost${path}`, undefined, { DB });
    await vi.runAllTimersAsync();
    return pending;
  }

  it('is waited out inside the request when it clears before the window ends', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The random pick is the one route that reads D1 and never reaches MyAnimeList, so the outcome
    // depends on nothing but the store: refused twice, then an empty catalogue → its own 404.
    const response = await request('/v1/random/anime', flakyDatabase(2));
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('NO_LOCAL_ENTRIES');
  });

  for (const path of ['/v1/users/ElectroHeavenVN/favorites', '/v1/users/ElectroHeavenVN/statistics'])
    it(`answers ${path} with 503 DATABASE_UNAVAILABLE, not 500, once the window is spent`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await request(path, stubDatabase('overloaded'));

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('10');
      expect(response.headers.get('x-cache-status')).toBe('error');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = (await response.json()) as { error: { code: string; requestId: string } };
      expect(body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    });
});

// The 19:30 UTC outage of 2026-11-16, through the real app: every statement fails at once with D1's
// internal error. It must read as the database being unavailable, and must not be retried.
describe('a D1 that fails with an internal error', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers 503 DATABASE_UNAVAILABLE and tries each statement once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const answer = async () => {
      attempts += 1;
      throw new Error('D1_ERROR: internal error; reference = 266snuice9ovn8g7c47fkh36');
    };
    const statement = { bind: () => statement, first: answer, run: answer, all: answer };
    const DB = { prepare: () => statement } as unknown as D1Database;

    const response = await app.request('http://localhost/v1/users/ElectroHeavenVN/favorites', undefined, { DB });

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('10');
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('DATABASE_UNAVAILABLE');
    // withCache starts two reads in parallel (the cache entry and the payload); each is tried once.
    expect(attempts).toBe(2);
  });
});
