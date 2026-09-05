import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';
import { QUERY_CONTRACT, UNSUPPORTED_PARAMS } from '../../src/http/query-contract';
import { stubDatabase } from '../helpers/stub-database';

const env = { DB: stubDatabase('ok') } as Partial<Env>;
const call = (path: string) => app.request(`http://localhost${path}`, undefined, env);
const body = async (response: Response) => (await response.json()) as { error?: { code: string; message: string } };

describe('query contract coverage', () => {
  // The guard is only as good as the table behind it, and a route added without an entry would be
  // silently unguarded — back to accepting anything. Enumerating the router is the only way to keep
  // the two in step without a catch-all, which Hono's ordered composition rules out.
  it('has an entry for every registered GET route', () => {
    const registered = [...new Set(app.routes.filter((route) => route.method === 'GET').map((route) => route.path))];
    const missing = registered.filter((path) => !(path in QUERY_CONTRACT));
    expect(missing).toEqual([]);
  });

  it('has no entry for a route that no longer exists', () => {
    const registered = new Set(app.routes.filter((route) => route.method === 'GET').map((route) => route.path));
    expect(Object.keys(QUERY_CONTRACT).filter((path) => !registered.has(path))).toEqual([]);
  });

  // These messages exist to hand the caller a way forward, so a substitute that is itself refused
  // is worse than none: it costs a second request to arrive at the same 400. `sfw` shipped for
  // weeks recommending `genres_exclude`, which has its own entry in this very table.
  it('never recommends a parameter that is itself refused', () => {
    const refused = new Set(Object.keys(UNSUPPORTED_PARAMS));
    const deadEnds = Object.entries(UNSUPPORTED_PARAMS).flatMap(([name, message]) =>
      [...message.matchAll(/"([^"]+)"/g)]
        .map((quoted) => quoted[1])
        .filter((token) => token !== name && refused.has(token))
        .map((token) => `${name} -> ${token}`),
    );
    expect(deadEnds).toEqual([]);
  });
});

describe('query guard', () => {
  it('lets a parameter the route declares through', async () => {
    expect((await call('/v1/anime?q=cowboy')).status).not.toBe(400);
  });

  it('refuses a parameter the route does not know, and says what it does take', async () => {
    const response = await call('/v1/anime?bogus=1');
    expect(response.status).toBe(400);
    const { error } = await body(response);
    expect(error?.code).toBe('UNKNOWN_PARAMETER');
    expect(error?.message).toContain('order_by');
  });

  // The whole point of the split: someone porting from Jikan has to be able to tell a typo apart
  // from a feature this API deliberately does not have.
  it('tells an unsupported Jikan parameter apart from an unknown one, and explains why', async () => {
    const { error } = await body(await call('/v1/anime?q=cowboy&sfw'));
    expect(error?.code).toBe('UNSUPPORTED_PARAMETER');
    expect(error?.message).toContain('"rating"');
  });

  it('refuses limit outside the user list routes, where it would slice a MAL page', async () => {
    expect((await body(await call('/v1/anime?q=cowboy&limit=5'))).error?.code).toBe('UNSUPPORTED_PARAMETER');
    expect((await call('/v1/users/Xinil/animelist?limit=5')).status).not.toBe(400);
  });

  it('refuses a bad page instead of quietly serving page 1', async () => {
    for (const page of ['0', 'abc', '-1', '999999']) {
      expect((await body(await call(`/v1/top/anime?page=${page}`))).error?.code).toBe('INVALID_PAGE');
    }
  });

  // MAL ignores an unrecognised ranking tab and serves the unfiltered list with a 200, so passing
  // the value straight through would answer 200 with the wrong data. And the two media genuinely
  // differ: topmanga.php has no publishing or upcoming tab.
  it('accepts the top filters each medium actually honours, and refuses the rest', async () => {
    expect((await call('/v1/top/anime?filter=airing')).status).not.toBe(400);
    expect((await call('/v1/top/manga?filter=bypopularity')).status).not.toBe(400);

    const bogus = await body(await call('/v1/top/anime?filter=bogus'));
    expect(bogus.error?.code).toBe('INVALID_FILTER');
    expect(bogus.error?.message).toContain('airing');

    // Valid for anime, silently ignored by MAL for manga — so it is refused rather than honoured.
    const wrongMedium = await body(await call('/v1/top/manga?filter=upcoming'));
    expect(wrongMedium.error?.code).toBe('INVALID_FILTER');
    expect(wrongMedium.error?.message).toBe('"filter" must be one of: bypopularity, favorite.');
  });

  it('guards routes that take nothing at all', async () => {
    const { error } = await body(await call('/v1/anime/1/themes?filter=bogus'));
    expect(error?.code).toBe('UNKNOWN_PARAMETER');
    expect(error?.message).toContain('takes none');
  });
});
