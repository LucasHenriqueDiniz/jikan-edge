import { describe, expect, it } from 'vitest';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import { SearchService } from '../../src/services/search.service';
import { classifyHtml } from '../../src/source/response-validator';
import { searchUrl } from '../../src/source/mal-urls';

// `?genres=N` with nothing else answered 200 with an empty list for every genre id, on both media.
// MyAnimeList redirects `anime.php?q=&genre[]=1` (301) to /anime/genre/1/Action, a genre-browse
// page. The search parser finds no result rows in that markup and returns [], so the caller was
// told "nothing matches Action" — 5012 titles by our own /v1/genres/anime count.
//
// Two independent things had to be wrong for that to reach a caller, so both are covered here: the
// URL invited the redirect, and the marker guarding the fetch was weak enough to accept the page it
// landed on.

describe('the URL keeps a genre-only search on the search page', () => {
  const paramsFor = (type: 'anime' | 'manga' | 'character' | 'people', page: number, extra: [string, string][] = []) =>
    new URL(searchUrl(type, '', page, extra)).searchParams;

  // MAL only redirects when a single genre is the whole request. `cat` is a hidden field in its own
  // search form, so sending it is not a trick — it is what a browser submits.
  it("sends the form's own cat field for anime and manga", () => {
    expect(paramsFor('anime', 1, [['genre[]', '1']]).get('cat')).toBe('anime');
    expect(paramsFor('manga', 1, [['genre[]', '1']]).get('cat')).toBe('manga');
  });

  // Character and people search carry a cat field too, but never redirect. Sending it there would
  // churn their caches for no behaviour change.
  it('leaves character and people search alone', () => {
    expect(paramsFor('character', 1).has('cat')).toBe(false);
    expect(paramsFor('people', 1).has('cat')).toBe(false);
  });

  // Page 2 was never broken, and that is the shape of the bug: `show=50` is a second parameter, and
  // a second parameter is all it took to suppress the redirect. Page 1 has no `show`.
  it('page 1 of a genre-only search is no longer a single-parameter request', () => {
    const page1 = paramsFor('anime', 1, [['genre[]', '1']]);
    expect(page1.has('show')).toBe(false);
    expect([...page1.keys()].filter((key) => key !== 'q')).toEqual(['cat', 'genre[]']);
  });
});

// A stub that runs the real classifier, so the marker is exercised the way MalClient exercises it
// rather than asserted against a copy of the rule.
function sourceServing(body: string): CatalogSource {
  return {
    getHtml: async (url: string, requiredMarkers: string[] = []) =>
      classifyHtml(
        body,
        { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: body.length },
        requiredMarkers,
      ),
  };
}

function stubDb() {
  const row = { first: async () => null, run: async () => ({ meta: { changes: 1 }, success: true }) };
  return { prepare: () => ({ bind: () => row, ...row }) } as never;
}

const PADDING = 'x'.repeat(600); // classifyHtml rejects anything under 512 chars as too small.
const GENRE_BROWSE_PAGE = `<html><head><title>Action - Anime - MyAnimeList.net</title></head><body><div id="filterByType"></div>${PADDING}</body></html>`;
const EMPTY_SEARCH_PAGE = `<html><head><title>Search Anime - MyAnimeList.net</title></head><body><div id="filterByType"></div>No titles that matched your query were found.${PADDING}</body></html>`;

describe('a page that is not the search page is refused instead of parsed as empty', () => {
  const service = (body: string) => new SearchService(stubDb(), { catalogTtlSeconds: 1 } as never, sourceServing(body));

  // The old marker was `filterByType`, which the genre-browse page also carries — it has a
  // type-filter widget of its own — so the wrong page passed the guard and the empty parse became
  // the answer. A loud 502 is the correct failure; a plausible wrong answer is not.
  it('rejects the genre-browse page MyAnimeList used to redirect us to', async () => {
    await expect(service(GENRE_BROWSE_PAGE).anime(undefined, 1, { genres: '1' }, 'req')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
    await expect(service(GENRE_BROWSE_PAGE).manga(undefined, 1, { genres: '1' }, 'req')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
  });

  // The tightening must not turn honest emptiness into an error: a search that matched nothing is
  // still served by the search page, title and all.
  it('still serves an empty list when the search page itself found nothing', async () => {
    const response = await service(EMPTY_SEARCH_PAGE).anime('zzzqqqxyznotitle', 1, {}, 'req');
    expect(response.data).toEqual([]);
  });
});
