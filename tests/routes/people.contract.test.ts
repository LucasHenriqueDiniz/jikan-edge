import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const detail = {
  malId: 11, name: 'Yamadera, Kouichi', givenName: 'Kouichi', familyName: 'Yamadera',
  alternateNames: 'Yama-chan', birthday: 'Jun 17, 1961', website: 'https://example.com',
  imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/1/1.jpg', about: 'Voice actor.',
  favorites: 9000, fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};
const anime = [{ animeId: 1, animeTitle: 'Cowboy Bebop', imageUrl: null, positions: ['Theme Song Performance'] }];
const manga = [{ mangaId: 2, mangaTitle: 'Berserk', imageUrl: null, positions: ['Story & Art'] }];
const voices = [{ animeId: 1, animeTitle: 'Cowboy Bebop', animeImageUrl: null, characterId: 1, characterName: 'Spike Spiegel', characterRole: 'Main', characterImageUrl: null }];

vi.mock('../../src/services/person.service', () => ({
  PersonService: class {
    async detail() { return served(detail); }
    async full() { return served({ ...detail, anime, manga, voices }); }
    async anime() { return served(anime); }
    async manga() { return served(manga); }
    async voices() { return served(voices); }
    async pictures() { return served([{ imageUrl: 'https://cdn.myanimelist.net/p.jpg', thumbnailUrl: null }]); }
    async news() { return served([{ malId: 5, title: 'News', url: 'https://myanimelist.net/news/5', imageUrl: null, excerpt: 'x', date: 'Jan 1', author: 'me' }]); }
    async topPeople() { return served([{ malId: 11, name: 'Yamadera, Kouichi', nameKanji: null, imageUrl: null, birthday: null, favorites: 9000 }]); }
  },
}));
vi.mock('../../src/services/search.service', () => ({
  SearchService: class {
    async people() { return served([{ malId: 11, name: 'Yamadera, Kouichi', url: 'https://myanimelist.net/people/11', imageUrl: null }]); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('people routes in Jikan shape', () => {
  it('serves a person detail', async () => {
    const { response, body } = await get('/v1/people/11');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ mal_id: 11, name: 'Yamadera, Kouichi', given_name: 'Kouichi', family_name: 'Yamadera', favorites: 9000 });
    expect(body.data.url).toBe('https://myanimelist.net/people/11');
    expect(body.data.images.jpg.image_url).toContain('cdn.myanimelist.net');
  });

  it('serves full, folding anime/manga/voices into one document', async () => {
    const { body } = await get('/v1/people/11/full');
    expectNoCamelCase(body.data);
    expect(body.data.mal_id).toBe(11);
    expect(body.data.anime[0].anime).toMatchObject({ mal_id: 1, title: 'Cowboy Bebop' });
    expect(body.data.voices[0].character).toMatchObject({ mal_id: 1, name: 'Spike Spiegel' });
  });

  it('serves the derived list routes', async () => {
    for (const path of ['/v1/people/11/anime', '/v1/people/11/manga', '/v1/people/11/voices', '/v1/people/11/pictures', '/v1/people/11/news']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body: staff } = await get('/v1/people/11/anime');
    expect(staff.data[0].positions).toEqual(['Theme Song Performance']);
    const { body: mangaBody } = await get('/v1/people/11/manga');
    expect(mangaBody.data[0].manga).toMatchObject({ mal_id: 2, title: 'Berserk' });
  });

  it('serves search and the top ranking', async () => {
    const { body: search } = await get('/v1/people?q=yama&page=3');
    expectListEnvelope(search);
    expect(search.pagination.current_page).toBe(3);
    expect(search.data[0].mal_id).toBe(11);

    const { body: top } = await get('/v1/top/people');
    expectListEnvelope(top);
    expect(top.data[0]).toMatchObject({ mal_id: 11, favorites: 9000 });
  });
});
