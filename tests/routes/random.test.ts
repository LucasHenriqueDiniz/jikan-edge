import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';
import { PARSER_VERSION } from '../../src/domain/user';
import { NO_STORE } from '../../src/http/caching';

const KINDS = ['anime', 'manga', 'characters', 'people'] as const;
const STANDARD_META = ['cached', 'fetchedAt', 'refreshFailed', 'stale'];

function dbWithRow(payload: unknown, fetchedAt = new Date().toISOString()): D1Database {
  const statement = {
    bind: () => statement,
    first: async () => ({ payload_json: JSON.stringify(payload), fetched_at: fetchedAt }),
    run: async () => ({ meta: {}, success: true }),
    all: async () => ({ results: [] }),
  };
  return { prepare: () => statement } as unknown as D1Database;
}

// One row that satisfies every query the users pick makes on its way through withCache: the
// username draw, the cache_entries lookup that decides the row is still fresh, and the profile read.
function dbWithCachedProfile(): D1Database {
  const now = new Date().toISOString();
  const row = {
    canonical_username: 'Xinil',
    username_key: 'xinil',
    profile_url: 'https://myanimelist.net/profile/Xinil',
    avatar_url: null,
    about: null,
    gender: null,
    location: null,
    birthday: null,
    joined_at: null,
    last_online_at: null,
    fetched_at: now,
    expires_at: new Date(Date.now() + 3_600 * 1_000).toISOString(),
    source_status: 'success',
    parser_version: PARSER_VERSION,
  };
  const statement = {
    bind: () => statement,
    first: async () => row,
    run: async () => ({ meta: {}, success: true }),
    all: async () => ({ results: [] }),
  };
  return { prepare: () => statement } as unknown as D1Database;
}

function dbWithNothing(): D1Database {
  const statement = {
    bind: () => statement,
    first: async () => null,
    run: async () => ({ meta: {}, success: true }),
    all: async () => ({ results: [] }),
  };
  return { prepare: () => statement } as unknown as D1Database;
}

const call = (path: string, db: D1Database) =>
  app.request(`http://localhost${path}`, undefined, { DB: db } as Partial<Env>);

// These four used to answer `meta: { requestId }` while `/v1/random/users` answered the standard
// four fields, so the random group did not agree with itself. The predecessor of this file asserted
// requestId was there *because* "every other route includes it" — the opposite was true: of the 93
// successful responses this API builds, that one was the only one carrying it. requestId belongs to
// error bodies, where it is the support-correlation handle; on a 200 it was noise that made these
// four the odd shape out.
describe('random picks report freshness like every other route', () => {
  it('answers the standard meta shape, not a lone requestId', async () => {
    for (const kind of KINDS) {
      const response = await call(`/v1/random/${kind}`, dbWithRow({ malId: 1, title: 'Cowboy Bebop' }));
      const body = (await response.json()) as { data: unknown; meta: Record<string, unknown> };
      expect(response.status, kind).toBe(200);
      expect(Object.keys(body.meta).sort(), kind).toEqual(STANDARD_META);
      expect(body.meta.requestId, kind).toBeUndefined();
      expect(body.data, kind).toEqual({ malId: 1, title: 'Cowboy Bebop' });
    }
  });

  // This is the one read path that never refreshes, so the age of the row it drew is the only
  // signal a caller has. Reporting `stale: false` unconditionally would be a claim nobody checked.
  it('works out staleness from the row it drew, in both directions', async () => {
    const fresh = await call('/v1/random/anime', dbWithRow({ malId: 1 }, new Date().toISOString()));
    expect(((await fresh.json()) as { meta: { stale: boolean } }).meta.stale).toBe(false);

    const old = new Date(Date.now() - 48 * 3_600 * 1_000).toISOString();
    const stale = await call('/v1/random/anime', dbWithRow({ malId: 1 }, old));
    const body = (await stale.json()) as {
      meta: { stale: boolean; fetchedAt: string; cached: boolean; refreshFailed: boolean };
    };
    expect(body.meta.stale).toBe(true);
    expect(body.meta.fetchedAt).toBe(old);
    // The pick always comes out of the local catalogue, and nothing was refreshed to get it.
    expect(body.meta.cached).toBe(true);
    expect(body.meta.refreshFailed).toBe(false);
  });

  it('still answers 404 NO_LOCAL_ENTRIES when the local catalogue is empty', async () => {
    const response = await call('/v1/random/anime', dbWithNothing());
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('NO_LOCAL_ENTRIES');
  });
});

// A shared cache that stored a random pick would pin one entity and hand it to everyone for the
// rest of its lifetime. Four of the five said `no-store`; `/v1/random/users` reads a real profile
// through withCache and so advertised that profile's remaining TTL — six hours of a CDN serving one
// "random" user.
describe('no random pick is cacheable', () => {
  it('sends no-store on every route in the group', async () => {
    for (const kind of KINDS) {
      const response = await call(`/v1/random/${kind}`, dbWithRow({ malId: 1 }));
      expect(response.headers.get('cache-control'), kind).toBe(NO_STORE);
    }
  });

  // Guarded separately, and on a real 200: this is the one pick that reaches withCache, and
  // withCache is what set the cacheable header. An error response is `no-store` too, so a test that
  // let this route fail would pass against the unfixed code.
  it('sends no-store on the users pick too, despite it reading a cached profile', async () => {
    const response = await call('/v1/random/users', dbWithCachedProfile());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(NO_STORE);
    expect(response.headers.get('x-cache-status')).toBe('hit');
    const body = (await response.json()) as { data: { canonicalUsername: string }; meta: Record<string, unknown> };
    expect(body.data.canonicalUsername).toBe('Xinil');
    expect(Object.keys(body.meta).sort()).toEqual(STANDARD_META);
  });
});
