import { describe, expect, it, vi } from 'vitest';
import { expectNoCamelCase, requester, served } from './contract-support';

/**
 * Random draws from the local D1 catalog only, so the interesting contract points are that the
 * drawn entity is mapped through the same shape as its own detail route, and that an empty
 * local catalog is a Jikan-shaped 404 rather than a 500.
 */

const animeEntry = {
  malId: 1, title: 'Cowboy Bebop', titleEnglish: 'Cowboy Bebop', titleJapanese: 'カウボーイビバップ',
  imageUrl: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg', synopsis: 'Bounty hunters.',
  type: 'TV', episodes: 26, status: 'Finished Airing', aired: 'Apr 3, 1998 to Apr 24, 1999',
  studios: [{ malId: 14, name: 'Sunrise', url: 'https://myanimelist.net/anime/producer/14' }],
  genres: [{ malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action' }],
  themes: [], duration: '24 min', rating: 'R', score: 8.75, rank: 41, popularity: 43,
  members: 1_900_000, favorites: 80_000, source: 'Original', relations: [], externalLinks: [],
  streaming: [], fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};

const { ServiceError } = await import('../../src/services/cacheable');

// `pick` returns the stored entity directly, not a ServiceResponse — random reads D1 only and
// has no refresh cycle, so there is no cache metadata to carry.
vi.mock('../../src/services/random.service', () => ({
  RandomService: class {
    async pick(kind: string) {
      if (kind === 'manga') throw new ServiceError('NO_LOCAL_ENTRIES', 404, 'No manga entries cached locally yet.');
      return animeEntry;
    }
    async pickUser() { return { username: 'amayacrab' }; }
  },
}));
vi.mock('../../src/services/user.service', () => ({
  UserService: class {
    async profile() {
      return served({
        username: 'amayacrab', canonicalUsername: 'amayacrab', profileUrl: 'https://myanimelist.net/profile/amayacrab',
        avatarUrl: null, about: null, gender: null, location: null, birthday: null, joinedAt: null,
        lastOnlineAt: null, fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
      });
    }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('random routes in Jikan shape', () => {
  it('maps a drawn anime exactly like its detail route would', async () => {
    const { response, body } = await get('/v1/random/anime');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ mal_id: 1, title: 'Cowboy Bebop', episodes: 26 });
    expect(body.data.images.jpg.image_url).toContain('cdn.myanimelist.net');
    expect(body.data.genres[0]).toMatchObject({ mal_id: 1, type: 'anime', name: 'Action' });
    expect(body.data.aired.string).toContain('1998');
  });

  it('maps a randomly drawn user through the same profile shape', async () => {
    const { response, body } = await get('/v1/random/users');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ username: 'amayacrab', mal_id: null });
    expect(body.data.images.jpg.image_url).toBeNull();
  });

  it('reports an empty local catalog as a Jikan-shaped 404', async () => {
    const { response, body } = await get('/v1/random/manga');
    expect(response.status).toBe(404);
    expect(body).toMatchObject({ status: 404, type: 'BadResponseException', error: 'NO_LOCAL_ENTRIES' });
    expect(body.requestId).toBeTruthy();
  });
});
