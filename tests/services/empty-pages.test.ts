import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { D1CatalogStore } from '../../src/adapters/d1-catalog-store';
import type { CatalogSource, SourceMetadata, SourceResult } from '../../src/ports/driven/catalog-source.port';
import { AnimeService } from '../../src/services/anime.service';
import { CharacterService } from '../../src/services/character.service';
import { MangaService } from '../../src/services/manga.service';
import { PersonService } from '../../src/services/person.service';
import { ReviewService } from '../../src/services/review.service';
import { parseReviewFilter } from '../../src/services/review-filter';
import { SearchService } from '../../src/services/search.service';
import { classifyHtml } from '../../src/source/response-validator';

// What MAL answers when there is nothing on a page — measured 2026-10-11 against every listing — and
// what the caller must get back: an empty page where the list simply ran out, a 404 where the thing
// asked for does not exist, and an error where the page is genuinely broken.

const config = { catalogTtlSeconds: 60, animeTtlSeconds: 60, sourceTimeoutMs: 1_000 } as never;

function stubDb() {
  const row = { first: async () => null, run: async () => ({ meta: { changes: 1 }, success: true }) };
  return { prepare: () => ({ bind: () => row, ...row }) } as never;
}

const meta = (url: string, extra: Partial<SourceMetadata> = {}): SourceMetadata => ({
  url,
  status: 200,
  contentType: 'text/html',
  durationMs: 1,
  sizeBytes: 1,
  ...extra,
});

// Records every URL asked for and answers with whatever `answer` returns for it.
function recordingSource(answer: (url: string, markers: string[]) => SourceResult<string>) {
  const calls: { url: string; markers: string[] }[] = [];
  const source: CatalogSource = {
    getHtml: async (url: string, markers: string[] = []) => {
      calls.push({ url, markers });
      return answer(url, markers);
    },
  };
  return { source, calls };
}

// The real classifier over a fixed body, so markers are checked the way MalClient checks them.
const serving = (body: string, extra: Partial<SourceMetadata> = {}) =>
  recordingSource((url, markers) => classifyHtml(body, meta(url, { sizeBytes: body.length, ...extra }), markers));

const notFound = () => recordingSource((url) => ({ kind: 'not_found', metadata: meta(url, { status: 404 }) }));

const store = () => new D1CatalogStore(stubDb());

describe('searches that match nothing', () => {
  // `anime.php?q=zzqqxxyyvvkk` is a 404 with "No titles that matched your query were found."
  it('answers an empty page for zero anime results, not NOT_FOUND', async () => {
    const { source } = notFound();
    const result = await new SearchService(store(), source, config).anime('zzqqxxyyvvkk', 1, {}, 'r');
    expect(result.data).toEqual([]);
  });

  it('answers an empty page past the last page of a search', async () => {
    const { source } = notFound();
    const result = await new SearchService(store(), source, config).manga('berserk', 5, {}, 'r');
    expect(result.data).toEqual([]);
  });

  it('answers an empty page for a character search with no match', async () => {
    const { source } = notFound();
    expect((await new SearchService(store(), source, config).characters('zzqqxxyyvv', 1, 'r')).data).toEqual([]);
  });

  // MAL stops paginating user search altogether past some offset and answers 400 (`show=2400`).
  it('treats a 400 past page 1 of a user search as the end, and a 400 on page 1 as the error it is', async () => {
    const badRequest = recordingSource((url) => ({ kind: 'upstream_error', metadata: meta(url, { status: 400 }) }));
    const service = new SearchService(store(), badRequest.source, config);
    expect((await service.users('xinil', 100, 'r')).data).toEqual([]);
    await expect(service.users('xinil', 1, 'r')).rejects.toMatchObject({ status: 503 });
  });
});

describe('short and padded queries', () => {
  // MAL answers a query under three characters as "No titles that matched"; quoted, it searches it.
  it('quotes a query shorter than three characters', async () => {
    const { source, calls } = notFound();
    await new SearchService(store(), source, config).anime('86', 1, {}, 'r');
    expect(new URL(calls[0].url).searchParams.get('q')).toBe('"86"');
  });

  it('leaves a longer query as typed, and asks for every result column', async () => {
    const { source, calls } = notFound();
    await new SearchService(store(), source, config).anime('frieren', 1, {}, 'r');
    const params = new URL(calls[0].url).searchParams;
    expect(params.get('q')).toBe('frieren');
    expect(params.getAll('c[]')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

describe('rankings past the end', () => {
  it('answers an empty page when a top list 404s past page 1', async () => {
    const { source } = notFound();
    expect((await new AnimeService(store(), source, config).topAnime(700, undefined, 'r')).data).toEqual([]);
  });

  it('still answers NOT_FOUND when page 1 of a ranking 404s', async () => {
    const { source } = notFound();
    await expect(new AnimeService(store(), source, config).topAnime(1, undefined, 'r')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  // `people.php?limit=999950` is a 200 with the page heading and no ranking rows.
  it('answers an empty page for a people ranking past its end, keyed on the heading', async () => {
    const body = `<html><head><title>People (49950 - ) - MyAnimeList.net</title></head><body><h1 class="h1">People</h1>${' '.repeat(600)}</body></html>`;
    const { source, calls } = serving(body);
    expect((await new PersonService(store(), source, config).topPeople(1000, 'r')).data).toEqual([]);
    expect(calls[0].markers).toEqual(['<h1 class="h1">People']);
  });
});

describe("a title's reviews past the last page", () => {
  const reviewsPage = readFileSync('tests/fixtures/reviews/one-piece-title-reviews-real.html', 'utf8');
  const page = `<html><body><div class="reviews-horiznav-nav-sort-block"></div>${reviewsPage}</body></html>`;

  // MAL answers 303 to page 1; without checking where the fetch landed, page 999 served page 1's cards.
  it('is an empty page when the fetch landed on another page', async () => {
    const { source } = serving(page, { finalUrl: 'https://myanimelist.net/anime/21/One_Piece/reviews?sort=suggested' });
    const result = await new AnimeService(store(), source, config).reviews(
      '21',
      999,
      parseReviewFilter(undefined, undefined),
      'r',
    );
    expect(result.data).toEqual([]);
  });

  it('is the page itself when the fetch stayed on it', async () => {
    const { source } = serving(page, { finalUrl: 'https://myanimelist.net/anime/21/x/reviews?p=2' });
    const result = await new AnimeService(store(), source, config).reviews(
      '21',
      2,
      parseReviewFilter(undefined, undefined),
      'r',
    );
    expect(result.data).toHaveLength(2);
  });

  // A title nobody has reviewed: 200, the heading, and a notice — 502 before, an empty list now.
  it('is an empty list for a title with no reviews', async () => {
    const { source } = serving(
      `<html><body><div class="reviews-horiznav-nav-sort-block"></div><div>No reviews have been submitted for this title.</div>${' '.repeat(600)}</body></html>`,
    );
    const result = await new AnimeService(store(), source, config).reviews(
      '47571',
      1,
      parseReviewFilter(undefined, undefined),
      'r',
    );
    expect(result.data).toEqual([]);
  });

  it('sends the preliminary and spoiler toggles MAL filters on', async () => {
    const { source, calls } = serving(page);
    await new AnimeService(store(), source, config).reviews('21', 1, parseReviewFilter('false', 'true'), 'r');
    const params = new URL(calls[0].url).searchParams;
    expect(params.get('preliminary')).toBe('off');
    expect(params.get('spoiler')).toBe('on');
  });
});

// Manga answers a review page past the last with a 404 rather than anime's redirect, and its page
// has no `<h2>Reviews` heading — the first marker tried took every manga's reviews down to 502.
describe("a manga's reviews", () => {
  it('is an empty page past the last one, where MAL answers 404', async () => {
    const { source } = notFound();
    const result = await new MangaService(store(), source, config).reviews(
      '116778',
      9999,
      parseReviewFilter(undefined, undefined),
      'r',
    );
    expect(result.data).toEqual([]);
  });

  it('reads a real manga review page, which carries the sort bar but no anime heading', async () => {
    const cards = readFileSync('tests/fixtures/reviews/one-piece-title-reviews-real.html', 'utf8');
    const { source, calls } = serving(
      `<html><body><div class="reviews-horiznav-nav-sort-block"></div>${cards}</body></html>`,
    );
    const result = await new MangaService(store(), source, config).reviews(
      '2',
      1,
      parseReviewFilter(undefined, undefined),
      'r',
    );
    expect(result.data).toHaveLength(2);
    expect(calls[0].markers).toEqual(['reviews-horiznav-nav-sort-block']);
  });
});

describe('the global review feed past the last page', () => {
  it('is an empty page', async () => {
    const { source } = notFound();
    expect(
      (await new ReviewService(store(), source, config).anime(999, parseReviewFilter(undefined, undefined), 'r')).data,
    ).toEqual([]);
  });
});

describe('episodes', () => {
  // `?offset=99900`: 200, the list heading, no rows.
  it('is an empty page past the last episode', async () => {
    const { source, calls } = serving(readFileSync('tests/fixtures/episodes/one-piece-past-end-real.html', 'utf8'));
    expect((await new AnimeService(store(), source, config).episodes('21', 1000, 'r')).data).toEqual([]);
    expect(calls[0].url).toBe('https://myanimelist.net/anime/21/x/episode?offset=99900');
  });

  // Past page 1 the marker is the list's heading, which a real page 2 carries above its rows.
  it('asks page 2 for the second block of 100', async () => {
    const rows = readFileSync('tests/fixtures/episodes/one-piece-filler-real.html', 'utf8');
    const { source, calls } = serving(`<h2 class="h2_overwrite">Episodes</h2>${rows}`);
    const result = await new AnimeService(store(), source, config).episodes('21', 2, 'r');
    expect(calls[0].url).toBe('https://myanimelist.net/anime/21/x/episode?offset=100');
    expect(result.data).toHaveLength(5);
  });

  // `/anime/21/x/episode/99999`: a 200 with an empty heading and a notice.
  it('is a 404 for an episode MAL has no page for', async () => {
    const missing = readFileSync('tests/fixtures/episodes/episode-detail-missing-real.html', 'utf8');
    const { source } = serving(`<html><body><h2 class="fw-b">Synopsis</h2>${missing}</body></html>`);
    await expect(new AnimeService(store(), source, config).episodeDetail('21', '99999', 'r')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('a character id that does not exist', () => {
  // MAL's page for it is a 200; it used to reach the caller as a 502.
  it('is a 404', async () => {
    const { source } = serving(readFileSync('tests/fixtures/characters/detail-invalid-id-real.html', 'utf8'));
    await expect(new CharacterService(store(), source, config).detail('99999999', 'r')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('seasons', () => {
  const sections = readFileSync('tests/fixtures/anime/season-sections-real.html', 'utf8');

  it('keeps continuing shows by default, as MAL lists them', async () => {
    const { source } = serving(sections);
    const result = await new AnimeService(store(), source, config).seasonNow(true, 'r');
    expect(result.data.map((entry) => entry.continuing)).toEqual([false, true, false]);
  });

  it('drops them with continuing=false', async () => {
    const { source } = serving(sections);
    const result = await new AnimeService(store(), source, config).seasonNow(false, 'r');
    expect(result.data).toHaveLength(2);
    expect(result.data.every((entry) => !entry.continuing)).toBe(true);
  });
});
