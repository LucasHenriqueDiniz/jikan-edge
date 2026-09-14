import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import { ServiceError } from '../../src/services/cacheable';
import { SearchService } from '../../src/services/search.service';
import { D1CatalogStore } from '../../src/adapters/d1-catalog-store';

function stubDb() {
  const row = { first: async () => null, run: async () => ({ meta: { changes: 1 }, success: true }) };
  return { prepare: () => ({ bind: () => row, ...row }) } as never;
}

// A byte-real Cowboy Bebop detail page (malId 1) — the same fixture the anime-detail parser is
// tested against, so the mapping is exercised end to end, not against invented markup.
const animeDetailHtml = readFileSync('tests/fixtures/anime/detail-real.html', 'utf8');
const mangaDetailHtml = readFileSync('tests/fixtures/manga/detail-real.html', 'utf8');

// MAL 303-redirects an exact-title search to the entity detail page (confirmed live, see
// docs/pitches/search-exact-match-redirect.md). MalClient follows the redirect, so the body the
// service receives is the detail page and metadata.finalUrl is the detail URL. The old title-string
// marker guard rejected that as UPSTREAM_SUSPICIOUS; landing-URL routing turns it into a match.
describe('anime search that MAL redirects to a detail page', () => {
  it('returns the matched title as a one-entry list instead of 502', async () => {
    const source: CatalogSource = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: animeDetailHtml,
        metadata: {
          url,
          finalUrl: 'https://myanimelist.net/anime/1/Cowboy_Bebop',
          status: 200,
          contentType: 'text/html',
          durationMs: 1,
          sizeBytes: animeDetailHtml.length,
        },
      }),
    };
    const service = new SearchService(new D1CatalogStore(stubDb()), source, { catalogTtlSeconds: 1 } as never);

    const result = await service.anime('Cowboy Bebop', 1, { orderBy: 'start_date', sort: 'desc' }, 'req');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      malId: 1,
      title: 'Cowboy Bebop',
      url: 'https://myanimelist.net/anime/1/Cowboy_Bebop',
    });
    expect(result.data[0]).toHaveProperty('episodes');
  });
});

describe('manga search that MAL redirects to a detail page', () => {
  it('returns a one-entry list carrying volumes (not episodes) instead of 502', async () => {
    const source: CatalogSource = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: mangaDetailHtml,
        metadata: {
          url,
          finalUrl: 'https://myanimelist.net/manga/2/Berserk',
          status: 200,
          contentType: 'text/html',
          durationMs: 1,
          sizeBytes: mangaDetailHtml.length,
        },
      }),
    };
    const service = new SearchService(new D1CatalogStore(stubDb()), source, { catalogTtlSeconds: 1 } as never);

    const result = await service.manga('Berserk', 1, { orderBy: 'start_date', sort: 'desc' }, 'req');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      malId: 2,
      title: 'Berserk',
      url: 'https://myanimelist.net/manga/2/Berserk',
    });
    expect(result.data[0]).toHaveProperty('volumes');
    expect(result.data[0]).not.toHaveProperty('episodes');
  });
});

// Neither the "User Search Results" list shape nor a single-profile redirect — an upstream page
// this parser has never seen. Before this fix, getHtml's requiredMarkers was `[]`, so classifyHtml
// let it through as `success`, and the raw ParserError from parseUserSearch surfaced as a generic
// 500 INTERNAL_ERROR instead of the 502 UPSTREAM_SUSPICIOUS every other route gives for this case.
describe('user search on an unrecognised page shape', () => {
  it('answers 502 UPSTREAM_SUSPICIOUS instead of a raw 500', async () => {
    const source: CatalogSource = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: `${'<html><body>'.padEnd(600, 'x')}</body></html>`,
        metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600 },
      }),
    };
    const service = new SearchService(new D1CatalogStore(stubDb()), source, { catalogTtlSeconds: 1 } as never);

    await expect(service.users('nonexistent-shape', 1, 'req')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
  });

  it('still throws ServiceError, not a raw ParserError, so the HTTP layer maps it correctly', async () => {
    const source: CatalogSource = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: `${'<html><body>'.padEnd(600, 'x')}</body></html>`,
        metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600 },
      }),
    };
    const service = new SearchService(new D1CatalogStore(stubDb()), source, { catalogTtlSeconds: 1 } as never);

    await expect(service.users('nonexistent-shape', 1, 'req')).rejects.toBeInstanceOf(ServiceError);
  });
});
