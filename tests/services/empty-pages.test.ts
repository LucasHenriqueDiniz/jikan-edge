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
    // Through the real classifier, so the service is checked against what the validator says about a 400.
    const badRequest = recordingSource((url) => classifyHtml('', meta(url, { status: 400 })));
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

  // A single-episode title (a movie, an OVA, a special) has no episode page: MAL answers it with the
  // same 404 page it gives an id with no title at all — measured 2026-11-16 on 28851 and 99999999,
  // identical down to the visible text. Only the title's own page tells them apart.
  describe('for a title MAL keeps no episode page for', () => {
    const detailPage = readFileSync('tests/fixtures/anime/detail-real.html', 'utf8');
    const episodesUrl = 'https://myanimelist.net/anime/28851/x/episode';
    const titleUrl = 'https://myanimelist.net/anime/28851';

    // Answers every read with nothing, except the anime row when `storedTitle`, and records writes.
    function recordingDb(storedTitle: boolean) {
      const writes: { sql: string; args: unknown[] }[] = [];
      const statement = (sql: string, args: unknown[]) => ({
        first: async () =>
          storedTitle && sql.includes('FROM anime WHERE') ? { payload_json: '{"malId":28851}' } : null,
        run: async () => {
          writes.push({ sql, args });
          return { meta: { changes: 1 }, success: true };
        },
      });
      const db = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => statement(sql, args) }) };
      const episodesWrite = () =>
        writes.find(
          (w) => w.sql.includes('INSERT INTO catalog_lists') && w.args[0] === 'catalog:anime:28851:episodes:page:1',
        );
      return { db: db as never, episodesWrite };
    }

    const malServing = (titleExists: boolean) =>
      recordingSource((url, markers) =>
        url === titleUrl && titleExists
          ? classifyHtml(detailPage, meta(url, { sizeBytes: detailPage.length }), markers)
          : { kind: 'not_found', metadata: meta(url, { status: 404 }) },
      );

    it('is an empty list when the title exists, and that empty list is cached', async () => {
      const { db, episodesWrite } = recordingDb(false);
      const { source, calls } = malServing(true);

      const result = await new AnimeService(new D1CatalogStore(db), source, config).episodes('28851', 1, 'r');

      expect(result.data).toEqual([]);
      expect(calls.map((call) => call.url)).toEqual([episodesUrl, titleUrl]);
      expect(episodesWrite()?.args[1]).toBe('[]');
    });

    it('is still NOT_FOUND when MAL has no title for the id, and nothing is cached', async () => {
      const { db, episodesWrite } = recordingDb(false);
      const { source } = malServing(false);

      await expect(
        new AnimeService(new D1CatalogStore(db), source, config).episodes('28851', 1, 'r'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
      expect(episodesWrite()).toBeUndefined();
    });

    // Only a 404 means "no page". A timeout on a title that has episodes must stay an error: an empty
    // list there would be cached for the whole TTL and hide every episode the title has.
    it('keeps an upstream failure an error, even for a title that exists', async () => {
      const { db, episodesWrite } = recordingDb(true);
      const { source, calls } = recordingSource((url) => ({ kind: 'timeout', metadata: meta(url, { status: 0 }) }));

      await expect(
        new AnimeService(new D1CatalogStore(db), source, config).episodes('28851', 1, 'r'),
      ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', status: 504 });
      expect(calls.map((call) => call.url)).toEqual([episodesUrl]);
      expect(episodesWrite()).toBeUndefined();
    });

    it('does not fetch the title page when the title is already stored', async () => {
      const { db } = recordingDb(true);
      const { source, calls } = malServing(true);

      const result = await new AnimeService(new D1CatalogStore(db), source, config).episodes('28851', 1, 'r');

      expect(result.data).toEqual([]);
      expect(calls.map((call) => call.url)).toEqual([episodesUrl]);
    });
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

// Titles MAL has nothing listed for. Each page is a 200 with the section's heading and a notice, and
// each answered 502 until 2026-11-05: the required marker came from the rows (or, on the detail page,
// the Genre label), so it was missing exactly when the list was empty. 53.6k of the day's requests.
// Through the real classifier, so the marker each route asks for is checked against the real page.
describe('a title MAL has nothing listed for', () => {
  const fixture = (path: string) => readFileSync(`tests/fixtures/${path}`, 'utf8');
  const page = (excerpt: string) => `<html><body>${excerpt}${' '.repeat(600)}</body></html>`;
  const anime = (body: string) => new AnimeService(store(), serving(body).source, config);
  const manga = (body: string) => new MangaService(store(), serving(body).source, config);

  it('answers detail and full for an anime without genres', async () => {
    const body = fixture('anime/detail-no-genres-real.html');
    const detail = await anime(body).detail('38099', 'r');
    expect(detail.data).toMatchObject({ malId: 38099, title: 'Pakkororin', genres: [], episodes: 1512 });
    expect((await anime(body).full('38099', 'r')).data).toMatchObject({ title: 'Pakkororin', genres: [] });
  });

  it('answers an empty episode list on page 1', async () => {
    const { source, calls } = serving(page(fixture('episodes/no-episode-info-real.html')));
    expect((await new AnimeService(store(), source, config).episodes('38099', 1, 'r')).data).toEqual([]);
    expect(calls[0].markers).toEqual(['<h2 class="h2_overwrite">Episodes</h2>']);
  });

  it('answers an empty cast, and the staff that is there', async () => {
    const body = page(fixture('characters/anime-no-characters-with-staff-real.html'));
    expect((await anime(body).characters('29955', 'r')).data).toEqual([]);
    expect((await anime(body).staff('29955', 'r')).data).toMatchObject([{ name: 'Okawara, Ryo', role: 'Director' }]);
    expect(
      (await manga(page(fixture('characters/manga-no-characters-real.html'))).characters('175006', 'r')).data,
    ).toEqual([]);
  });

  it('answers empty recommendations and forum, on anime and manga', async () => {
    expect(
      (await anime(page(fixture('recommendations/anime-no-recs-real.html'))).recommendations('6891', 'r')).data,
    ).toEqual([]);
    expect(
      (await manga(page(fixture('recommendations/manga-no-recs-real.html'))).recommendations('175006', 'r')).data,
    ).toEqual([]);
    expect((await anime(page(fixture('forum/anime-no-topics-real.html'))).forum('38099', 'r')).data).toEqual([]);
    expect((await manga(page(fixture('forum/manga-no-topics-real.html'))).forum('175006', 'r')).data).toEqual([]);
  });

  // MAL's empty news page carries no notice — the heading, then nothing (measured 2026-11-18). The
  // old marker came from the rows, so every title without news answered 502, uncached, every poll.
  it('answers empty news, on anime, manga and people', async () => {
    const { source, calls } = serving(page(fixture('news/anime-no-news-real.html')));
    expect((await new AnimeService(store(), source, config).news('124', 'r')).data).toEqual([]);
    expect(calls[0].markers).toEqual(['<h2 class="mb8">News</h2>']);
    expect((await manga(page(fixture('news/manga-no-news-real.html'))).news('120000', 'r')).data).toEqual([]);
    const person = serving(page(fixture('news/person-no-news-real.html')));
    expect((await new PersonService(store(), person.source, config).news('60000', 'r')).data).toEqual([]);
  });

  // The title's detail page is what MAL serves for a sub-path it does not know; it has a "Recent
  // News" block, but not the news page's heading, so it is never read as a title without news.
  it('does not read the detail page as a news page', async () => {
    await expect(anime(fixture('anime/detail-real.html')).news('1', 'r')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
  });

  // The marker still has a job: a page that is not the one asked for stays a 502.
  it('is still a 502 when the section heading is missing', async () => {
    const notTheEpisodesPage = page(fixture('episodes/no-episode-info-real.html').replace('h2_overwrite', 'h2'));
    await expect(anime(notTheEpisodesPage).episodes('38099', 1, 'r')).rejects.toMatchObject({
      code: 'UPSTREAM_SUSPICIOUS',
      status: 502,
    });
    const notADetailPage = fixture('anime/detail-no-genres-real.html').replace('<h2>Information</h2>', '');
    await expect(anime(notADetailPage).detail('38099', 'r')).rejects.toMatchObject({ status: 502 });
  });
});
