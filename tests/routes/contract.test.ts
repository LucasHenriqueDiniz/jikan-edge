import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';
import { readFileSync } from 'node:fs';

const animeHtml = readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8');
const mangaHtml = readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8');

const served = <T>(data: T) => ({ data, cached: true, stale: false, refreshFailed: false, fetchedAt: '2026-07-28T00:00:00.000Z' });

// Handlers build their service inline from c.env.DB, so there is no injection seam — mocking the
// modules is what lets a request go through real routing, real middleware, the real mapper and
// the real envelope without touching D1 or the network.
const animeDetail = parseAnimeDetail(animeHtml, 1, '2026-07-19T00:00:00.000Z');
const mangaDetail = parseMangaDetail(mangaHtml, 2, '2026-07-19T00:00:00.000Z');

vi.mock('../../src/services/anime.service', () => ({
  AnimeService: class {
    async detail() { return served(animeDetail); }
    async topAnime() { return served([{ malId: 5, title: 'Top', imageUrl: null, score: 9, type: 'TV', episodes: 12, startDate: '2020', members: 10 }]); }
    async schedule() {
      return served({ monday: [{ malId: 7, title: 'Mon', imageUrl: null, score: null, type: 'TV', episodes: null, startDate: null, members: null }], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [], other: [], unknown: [] });
    }
  },
}));
vi.mock('../../src/services/manga.service', () => ({
  MangaService: class {
    async detail() { return served(mangaDetail); }
  },
}));

const { default: app } = await import('../../src/app');

/**
 * The single regression net for a 94-route rename: nothing under `data` or `pagination` may keep
 * a camelCase key. `meta` is ours and is deliberately exempt.
 */
function expectNoCamelCase(value: unknown, path = 'data'): void {
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

// The mocked services ignore it, but the handlers still read c.env.DB to construct them.
const env = { DB: {} as D1Database, WORKER_VERSION: 'test' };

async function get(path: string) {
  const response = await app.request(`http://localhost${path}`, {}, env);
  return { response, body: (await response.json()) as Record<string, any> };
}

describe('jikan v4 response contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves an anime detail in Jikan shape', async () => {
    const { response, body } = await get('/v1/anime/1');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data.mal_id).toBe(1);
    expect(body.data.url).toBe('https://myanimelist.net/anime/1');
    expect(body.data.images.jpg.image_url).toContain('cdn.myanimelist.net');
    expect(body.data.images.webp.image_url).toBeNull();
    expect(body.data.titles).toContainEqual({ type: 'Default', title: 'Cowboy Bebop' });
    expect(body.data.aired.string).toContain('1998');
    expect(body.data.genres).toContainEqual({ mal_id: 1, type: 'anime', name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action' });
    expect(body.data.studios[0].mal_id).toBe(14);
    expect(body.data.relations[0]).toMatchObject({ relation: 'Adaptation' });
    // Fields MAL never gives us are present-and-null, never missing.
    for (const key of ['approved', 'scored_by', 'background', 'season', 'year']) expect(body.data).toHaveProperty(key, null);
    expect(body.data.licensors).toEqual([]);
  });

  it('keeps our cache signalling alongside the Jikan envelope', async () => {
    const { body } = await get('/v1/anime/1');
    expect(body.meta).toMatchObject({ cached: true, stale: false, refreshFailed: false });
    expect(body).not.toHaveProperty('pagination');
  });

  it('serves a manga detail in Jikan shape', async () => {
    const { body } = await get('/v1/manga/2');
    expectNoCamelCase(body.data);
    expect(body.data.mal_id).toBe(2);
    expect(body.data.authors[0]).toMatchObject({ mal_id: 1868, type: 'people' });
    expect(body.data.demographics[0].name).toBe('Seinen');
    expect(body.data.published.string).toBeTruthy();
  });

  it('reports honest pagination when it only served one upstream page', async () => {
    const { body } = await get('/v1/top/anime?page=3');
    expectNoCamelCase(body.data);
    expectNoCamelCase(body.pagination, 'pagination');
    expect(body.pagination).toEqual({
      last_visible_page: 3,
      has_next_page: false,
      current_page: 3,
      items: { count: 1, total: null, per_page: 1 },
    });
  });

  it('flattens schedules into an array and keeps the day in broadcast', async () => {
    const { body } = await get('/v1/schedules');
    expect(Array.isArray(body.data)).toBe(true);
    expectNoCamelCase(body.data);
    expect(body.data[0]).toMatchObject({ mal_id: 7, broadcast: { day: 'Mondays' } });
  });

  it('reports errors in Jikan shape', async () => {
    const { response, body } = await get('/v1/nope');
    expect(response.status).toBe(404);
    expect(body).toMatchObject({ status: 404, type: 'BadResponseException', message: 'Resource does not exist', error: 'NOT_FOUND' });
    expect(body.requestId).toBeTruthy();
    expect(body).not.toHaveProperty('error.code');
  });
});
