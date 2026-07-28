import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

/**
 * The derived routes hanging off an anime or manga id — the largest block of the surface.
 * Details themselves live in contract.test.ts; this file covers everything under /:id plus
 * search, seasons and genres.
 */

const animeDetail = parseAnimeDetail(readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8'), 1, '2026-07-19T00:00:00.000Z');
const mangaDetail = parseMangaDetail(readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8'), 2, '2026-07-19T00:00:00.000Z');

const characters = [{ malId: 1, name: 'Spike Spiegel', imageUrl: null, role: 'Main', favorites: 62000, voiceActors: [{ malId: 11, name: 'Yamadera, Kouichi', language: 'Japanese', imageUrl: null }] }];
const staff = [{ malId: 14, name: 'Watanabe, Shinichiro', imageUrl: null, role: 'Director' }];
const statistics = {
  status: { inProgress: 10, completed: 20, onHold: 3, dropped: 2, planned: 5, total: 40 },
  scores: [{ score: 10, votes: 100, percentage: 25 }],
  fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};
const news = [{ malId: 5, title: 'News', url: 'https://myanimelist.net/news/5', imageUrl: null, excerpt: 'x', date: 'Jan 1', author: 'me' }];
const forum = [{ topicId: 7, title: 'Thread', startedBy: 'user', startedDate: 'Jan 1', replies: 4, lastPostBy: 'other' }];
const pictures = [{ imageUrl: 'https://cdn.myanimelist.net/p.jpg', thumbnailUrl: null }];
const titleRecs = [{ malId: 205, title: 'Samurai Champloo', imageUrl: null, votes: 30 }];
const titleReviews = [{ username: 'reviewer', imageUrl: null, date: 'Jan 1', tag: 'Recommended', score: 9, reviewText: 'Great.' }];
const userUpdates = [{ username: 'user', imageUrl: null, score: 8, status: 'watching', progress: 3, total: 26, date: 'Jan 1' }];
const searchResults = [{ malId: 1, title: 'Cowboy Bebop', imageUrl: null, synopsis: 'x', type: 'TV', episodes: 26, score: 8.75 }];
const listEntries = [{ malId: 1, title: 'Cowboy Bebop', imageUrl: null, score: 8.75, type: 'TV', episodes: 26, startDate: '1998', members: 100 }];
const genres = [{ malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action' }];

vi.mock('../../src/services/anime.service', () => ({
  AnimeService: class {
    async detail() { return served(animeDetail); }
    async full() { return served({ ...animeDetail, themeSongs: { openings: [{ title: 'Tank!', artist: 'Seatbelts', episodes: '1-25' }], endings: [] } }); }
    async relations() { return served(animeDetail.relations); }
    async externalLinks() { return served([{ name: 'Official site', url: 'https://example.com' }]); }
    async streaming() { return served([{ name: 'Crunchyroll', url: 'https://crunchyroll.com', available: true }]); }
    async characters() { return served(characters); }
    async staff() { return served(staff); }
    async statistics() { return served(statistics); }
    async pictures() { return served(pictures); }
    async news() { return served(news); }
    async forum() { return served(forum); }
    async episodes() { return served([{ number: 1, title: 'Asteroid Blues', titleJapanese: 'アステロイド・ブルース', url: 'https://myanimelist.net/anime/1/x/episode/1', aired: 'Apr 3, 1998', score: 4.3, forumReplies: 12 }]); }
    async episodeDetail() { return served({ malId: 1, episode: 1, title: 'Asteroid Blues', titleAlternative: null, duration: '24 min', aired: 'Apr 3, 1998', synopsis: 'x' }); }
    async recommendations() { return served(titleRecs); }
    async reviews() { return served(titleReviews); }
    async videos() { return served({ promos: [{ title: 'PV', videoUrl: 'https://www.youtube.com/embed/abc123', imageUrl: null }], musicVideos: [], episodes: [] }); }
    async videosEpisodes() { return served([{ episode: 1, title: 'Asteroid Blues', url: 'https://myanimelist.net/anime/1/x/episode/1', imageUrl: null }]); }
    async userUpdates() { return served(userUpdates); }
    async themes() { return served({ openings: [{ title: 'Tank!', artist: 'Seatbelts', episodes: '1-25' }], endings: [] }); }
    async moreInfo() { return served({ text: null }); }
    async genres() { return served(genres); }
    async topAnime() { return served(listEntries); }
    async seasonNow() { return served(listEntries); }
    async seasonUpcoming() { return served(listEntries); }
    async seasonByYear() { return served(listEntries); }
    async seasonArchive() { return served([{ year: 1998, seasons: ['winter', 'spring'] }]); }
    async schedule() { return served({ monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [], other: [], unknown: [] }); }
  },
}));
vi.mock('../../src/services/manga.service', () => ({
  MangaService: class {
    async detail() { return served(mangaDetail); }
    async full() { return served(mangaDetail); }
    async relations() { return served(mangaDetail.relations); }
    async externalLinks() { return served([{ name: 'Official site', url: 'https://example.com' }]); }
    async characters() { return served(characters); }
    async statistics() { return served(statistics); }
    async pictures() { return served(pictures); }
    async news() { return served(news); }
    async forum() { return served(forum); }
    async recommendations() { return served(titleRecs); }
    async reviews() { return served(titleReviews); }
    async userUpdates() { return served(userUpdates); }
    async moreInfo() { return served({ text: 'Extra.' }); }
    async genres() { return served(genres); }
    async topManga() { return served([{ malId: 2, title: 'Berserk', imageUrl: null, score: 9.4, type: 'Manga', volumes: 41, startDate: '1989', members: 500 }]); }
  },
}));
vi.mock('../../src/services/search.service', () => ({
  SearchService: class {
    async anime() { return served(searchResults); }
    async manga() { return served(searchResults); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

const ANIME_LISTS = [
  '/v1/anime/1/relations', '/v1/anime/1/external', '/v1/anime/1/streaming', '/v1/anime/1/characters',
  '/v1/anime/1/staff', '/v1/anime/1/pictures', '/v1/anime/1/news', '/v1/anime/1/forum',
  '/v1/anime/1/episodes', '/v1/anime/1/recommendations', '/v1/anime/1/reviews',
  '/v1/anime/1/videos/episodes', '/v1/anime/1/userupdates',
];
const MANGA_LISTS = [
  '/v1/manga/2/relations', '/v1/manga/2/external', '/v1/manga/2/characters', '/v1/manga/2/pictures',
  '/v1/manga/2/news', '/v1/manga/2/forum', '/v1/manga/2/recommendations', '/v1/manga/2/reviews',
  '/v1/manga/2/userupdates',
];
const SINGLES = [
  '/v1/anime/1/full', '/v1/anime/1/statistics', '/v1/anime/1/videos', '/v1/anime/1/episodes/1',
  '/v1/anime/1/themes', '/v1/anime/1/moreinfo', '/v1/manga/2/full', '/v1/manga/2/statistics',
  '/v1/manga/2/moreinfo',
];

describe('anime and manga derived routes in Jikan shape', () => {
  it('serves every list-shaped sub-route without a camelCase key', async () => {
    for (const path of [...ANIME_LISTS, ...MANGA_LISTS]) {
      const { response, body } = await get(path);
      expect(response.status, path).toBe(200);
      expectListEnvelope(body);
    }
  });

  it('serves every object-shaped sub-route without a camelCase key', async () => {
    for (const path of SINGLES) {
      const { response, body } = await get(path);
      expect(response.status, path).toBe(200);
      expectNoCamelCase(body.data);
    }
  });

  it('nests characters, staff and voice actors the way Jikan does', async () => {
    const { body } = await get('/v1/anime/1/characters');
    expect(body.data[0].character).toMatchObject({ mal_id: 1, name: 'Spike Spiegel' });
    expect(body.data[0].role).toBe('Main');
    expect(body.data[0].voice_actors[0].person).toMatchObject({ mal_id: 11 });

    const { body: staffBody } = await get('/v1/anime/1/staff');
    expect(staffBody.data[0].person).toMatchObject({ mal_id: 14 });
    expect(staffBody.data[0].positions).toEqual(['Director']);
  });

  it('reports statistics with Jikan field names', async () => {
    const { body } = await get('/v1/anime/1/statistics');
    expect(body.data).toMatchObject({ watching: 10, completed: 20, on_hold: 3, dropped: 2, plan_to_watch: 5, total: 40 });
    expect(body.data.scores[0]).toMatchObject({ score: 10, votes: 100, percentage: 25 });

    const { body: manga } = await get('/v1/manga/2/statistics');
    expect(manga.data).toMatchObject({ reading: 10, plan_to_read: 5 });
  });

  it('serves themes, moreinfo and episode detail', async () => {
    const { body: themes } = await get('/v1/anime/1/themes');
    expect(themes.data.openings[0]).toContain('Tank!');

    const { body: absent } = await get('/v1/anime/1/moreinfo');
    expect(absent.data).toEqual({ moreinfo: null });
    const { body: present } = await get('/v1/manga/2/moreinfo');
    expect(present.data).toEqual({ moreinfo: 'Extra.' });

    const { body: episode } = await get('/v1/anime/1/episodes/1');
    expect(episode.data).toMatchObject({ mal_id: 1, title: 'Asteroid Blues', duration: '24 min' });
  });

  it('serves search, seasons and genres', async () => {
    for (const path of ['/v1/anime?q=bebop&page=2', '/v1/manga?q=berserk', '/v1/seasons', '/v1/seasons/now', '/v1/seasons/upcoming', '/v1/seasons/1998/spring', '/v1/genres/anime', '/v1/genres/manga', '/v1/top/manga']) {
      const { response, body } = await get(path);
      expect(response.status, path).toBe(200);
      expectListEnvelope(body);
    }
    const { body: search } = await get('/v1/anime?q=bebop&page=2');
    expect(search.pagination.current_page).toBe(2);
    expect(search.data[0]).toMatchObject({ mal_id: 1, episodes: 26 });

    const { body: archive } = await get('/v1/seasons');
    expect(archive.data[0]).toEqual({ year: 1998, seasons: ['winter', 'spring'] });

    const { body: genresBody } = await get('/v1/genres/anime');
    expect(genresBody.data[0]).toMatchObject({ mal_id: 1, name: 'Action' });
  });
});
