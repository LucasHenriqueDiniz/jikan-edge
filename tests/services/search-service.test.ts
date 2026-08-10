import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../src/services/cacheable';
import { SearchService } from '../../src/services/search.service';

function stubDb() {
  const row = { first: async () => null, run: async () => ({ meta: { changes: 1 }, success: true }) };
  return { prepare: () => ({ bind: () => row, ...row }) } as never;
}

// Neither the "User Search Results" list shape nor a single-profile redirect — an upstream page
// this parser has never seen. Before this fix, getHtml's requiredMarkers was `[]`, so classifyHtml
// let it through as `success`, and the raw ParserError from parseUserSearch surfaced as a generic
// 500 INTERNAL_ERROR instead of the 502 UPSTREAM_SUSPICIOUS every other route gives for this case.
describe('user search on an unrecognised page shape', () => {
  it('answers 502 UPSTREAM_SUSPICIOUS instead of a raw 500', async () => {
    const source = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: '<html><body>'.padEnd(600, 'x') + '</body></html>',
        metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600 },
      }),
    };
    const service = new SearchService(stubDb(), { catalogTtlSeconds: 1 } as never, source as never);

    await expect(service.users('nonexistent-shape', 1, 'req')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
  });

  it('still throws ServiceError, not a raw ParserError, so the HTTP layer maps it correctly', async () => {
    const source = {
      getHtml: async (url: string) => ({
        kind: 'success' as const,
        value: '<html><body>'.padEnd(600, 'x') + '</body></html>',
        metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600 },
      }),
    };
    const service = new SearchService(stubDb(), { catalogTtlSeconds: 1 } as never, source as never);

    await expect(service.users('nonexistent-shape', 1, 'req')).rejects.toBeInstanceOf(ServiceError);
  });
});
