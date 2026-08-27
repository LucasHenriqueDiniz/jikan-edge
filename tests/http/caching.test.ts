import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';
import { cacheControlFor, etagFor, matchesEtag, NO_STORE } from '../../src/http/caching';
import { stubDatabase } from '../helpers/stub-database';

const SIX_HOURS = 21_600;
const NOW = Date.parse('2026-08-27T12:00:00.000Z');
const encode = (value: string) => new TextEncoder().encode(value).buffer as ArrayBuffer;

describe('cacheControlFor', () => {
  it('advertises the freshness that remains, not the whole TTL', () => {
    // Fetched five hours into a six-hour TTL: one hour left. Advertising the full TTL would let a
    // shared cache serve this for five hours after this API already considers it stale.
    const fetchedAt = new Date(NOW - 5 * 3_600 * 1_000).toISOString();
    expect(cacheControlFor({ stale: false, fetchedAt, ttlSeconds: SIX_HOURS }, NOW))
      .toBe(`public, max-age=3600, stale-while-revalidate=${SIX_HOURS}`);
  });

  it('gives a freshly fetched resource the full TTL', () => {
    const fetchedAt = new Date(NOW).toISOString();
    expect(cacheControlFor({ stale: false, fetchedAt, ttlSeconds: SIX_HOURS }, NOW))
      .toBe(`public, max-age=${SIX_HOURS}, stale-while-revalidate=${SIX_HOURS}`);
  });

  it('tells a stale body to revalidate rather than compounding staleness downstream', () => {
    const fetchedAt = new Date(NOW - 3_600 * 1_000).toISOString();
    expect(cacheControlFor({ stale: true, fetchedAt, ttlSeconds: SIX_HOURS }, NOW)).toContain('max-age=0');
  });

  it('never returns a negative max-age once the TTL is past', () => {
    const fetchedAt = new Date(NOW - 99 * 3_600 * 1_000).toISOString();
    expect(cacheControlFor({ stale: false, fetchedAt, ttlSeconds: SIX_HOURS }, NOW)).toContain('max-age=0');
  });

  it('says nothing at all when there is no TTL to advertise', () => {
    // The random picks read D1 directly and never go through withCache, so they have no lifetime.
    expect(cacheControlFor({ stale: false, fetchedAt: new Date(NOW).toISOString() }, NOW)).toBeNull();
  });

  // A clock skew or a corrupt row must not be able to extend a resource's advertised life.
  it('does not grant extra life for an unparseable or future timestamp', () => {
    expect(cacheControlFor({ stale: false, fetchedAt: 'not a date', ttlSeconds: SIX_HOURS }, NOW)).toContain(`max-age=${SIX_HOURS}`);
    const future = new Date(NOW + 10 * 3_600 * 1_000).toISOString();
    expect(cacheControlFor({ stale: false, fetchedAt: future, ttlSeconds: SIX_HOURS }, NOW)).toContain(`max-age=${SIX_HOURS}`);
  });
});

describe('etagFor', () => {
  it('is stable for identical bytes and different for changed ones', async () => {
    const body = '{"data":{"malId":1}}';
    expect(await etagFor(encode(body))).toBe(await etagFor(encode(body)));
    expect(await etagFor(encode(body))).not.toBe(await etagFor(encode('{"data":{"malId":2}}')));
  });

  it('is a quoted strong validator', async () => {
    expect(await etagFor(encode('x'))).toMatch(/^"[0-9a-f]{16}"$/);
  });

  // The tag has to cover meta, not just data: `cached` flips false -> true between the request that
  // refreshed a payload and every read after it, so a tag derived from the resource key and
  // fetchedAt alone would call two visibly different bodies identical.
  it('changes when only the meta block differs', async () => {
    const withMiss = '{"data":{"malId":1},"meta":{"cached":false}}';
    const withHit = '{"data":{"malId":1},"meta":{"cached":true}}';
    expect(await etagFor(encode(withMiss))).not.toBe(await etagFor(encode(withHit)));
  });
});

// If-None-Match is a list, may be `*`, and may mark entries weak. A plain equality check would
// hand those callers the full body and look like "revalidation just doesn't work here".
describe('matchesEtag', () => {
  it('matches a single tag', () => {
    expect(matchesEtag('"abc"', '"abc"')).toBe(true);
    expect(matchesEtag('"abc"', '"def"')).toBe(false);
  });

  it('matches any tag in a list', () => {
    expect(matchesEtag('"one", "two", "three"', '"two"')).toBe(true);
    expect(matchesEtag('"one", "two"', '"three"')).toBe(false);
  });

  it('treats W/ as weakly equal, which is the right comparison here', () => {
    expect(matchesEtag('W/"abc"', '"abc"')).toBe(true);
    expect(matchesEtag('"abc"', 'W/"abc"')).toBe(true);
  });

  it('matches everything for *', () => {
    expect(matchesEtag('*', '"anything"')).toBe(true);
  });

  it('is false when the header is absent or empty', () => {
    expect(matchesEtag(undefined, '"abc"')).toBe(false);
    expect(matchesEtag('', '"abc"')).toBe(false);
  });
});

describe('cache headers on real responses', () => {
  const env = { DB: stubDatabase('ok') } as Partial<Env>;
  const call = (path: string, init?: RequestInit) => app.request(`http://localhost${path}`, init, env);

  // A CDN that stored an upstream outage or a rate-limit answer would outlive the condition that
  // caused it. Handlers can also have set a success Cache-Control before throwing.
  it('never lets an error be cached', async () => {
    for (const path of ['/v1/anime', '/v1/clubs/0', '/v1/anime/1?bogus=1']) {
      const response = await call(path);
      expect(response.status, path).toBeGreaterThanOrEqual(400);
      expect(response.headers.get('cache-control'), path).toBe(NO_STORE);
    }
  });

  it('does not attach a validator to a response it refuses to cache', async () => {
    const response = await call('/v1/anime');
    expect(response.headers.get('etag')).toBeNull();
  });
});
