import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const detail = {
  malId: 1, name: 'Spike Spiegel', nameKanji: 'スパイク・スピーゲル',
  imageUrl: 'https://cdn.myanimelist.net/images/characters/4/50197.jpg',
  about: 'Bounty hunter.', favorites: 62000, fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};
const media = [{ malId: 1, title: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/a.jpg', role: 'Main' }];
const voices = [{ malId: 11, name: 'Yamadera, Kouichi', language: 'Japanese', imageUrl: null }];

vi.mock('../../src/services/character.service', () => ({
  CharacterService: class {
    async detail() { return served(detail); }
    async full() { return served({ ...detail, anime: media, manga: media, voices }); }
    async anime() { return served(media); }
    async manga() { return served(media); }
    async voices() { return served(voices); }
    async pictures() { return served([{ imageUrl: 'https://cdn.myanimelist.net/p.jpg', thumbnailUrl: 'https://cdn.myanimelist.net/t.jpg' }]); }
    async topCharacters() {
      return served([{ malId: 1, name: 'Spike Spiegel', nameKanji: null, imageUrl: null, animeography: [{ malId: 1, title: 'Cowboy Bebop' }], mangaography: [], favorites: 62000 }]);
    }
  },
}));
vi.mock('../../src/services/search.service', () => ({
  SearchService: class {
    async characters() { return served([{ malId: 1, name: 'Spike Spiegel', url: 'https://myanimelist.net/character/1', imageUrl: null }]); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('characters routes in Jikan shape', () => {
  it('serves a character detail', async () => {
    const { response, body } = await get('/v1/characters/1');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ mal_id: 1, name: 'Spike Spiegel', name_kanji: 'スパイク・スピーゲル', favorites: 62000 });
    expect(body.data.url).toBe('https://myanimelist.net/character/1');
    expect(body.data.images.jpg.image_url).toContain('cdn.myanimelist.net');
  });

  it('serves full, which folds anime/manga/voices into one document', async () => {
    const { body } = await get('/v1/characters/1/full');
    expectNoCamelCase(body.data);
    expect(body.data.mal_id).toBe(1);
    // Jikan nests the work under a key named after the media type, without a `type` field.
    expect(body.data.anime[0].anime).toMatchObject({ mal_id: 1, title: 'Cowboy Bebop' });
    expect(body.data.voices[0].person).toMatchObject({ mal_id: 11 });
    expect(body.data.voices[0].language).toBe('Japanese');
  });

  it('serves the derived list routes', async () => {
    for (const path of ['/v1/characters/1/anime', '/v1/characters/1/manga', '/v1/characters/1/voices', '/v1/characters/1/pictures']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body: anime } = await get('/v1/characters/1/anime');
    expect(anime.data[0]).toMatchObject({ role: 'Main' });
    const { body: pics } = await get('/v1/characters/1/pictures');
    expect(pics.data[0].jpg).toMatchObject({ small_image_url: 'https://cdn.myanimelist.net/t.jpg' });
  });

  it('serves search and the top ranking', async () => {
    const { body: search } = await get('/v1/characters?q=spike&page=2');
    expectListEnvelope(search);
    expect(search.pagination.current_page).toBe(2);
    expect(search.data[0].mal_id).toBe(1);

    const { body: top } = await get('/v1/top/characters');
    expectListEnvelope(top);
    expect(top.data[0].animeography[0]).toMatchObject({ mal_id: 1, type: 'anime' });
  });
});
