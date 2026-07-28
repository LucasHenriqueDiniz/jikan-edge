import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const profile = {
  username: 'amayacrab', canonicalUsername: 'amayacrab', profileUrl: 'https://myanimelist.net/profile/amayacrab',
  avatarUrl: 'https://cdn.myanimelist.net/images/userimages/1.jpg', about: 'hi', gender: 'Female',
  location: 'Brazil', birthday: 'Jan 1', joinedAt: 'Feb 2020', lastOnlineAt: 'Now',
  fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};
const statistics = {
  anime: { watching: 1, completed: 2, onHold: 3, dropped: 4, planToWatch: 5, totalEntries: 15, episodesWatched: 100, meanScore: 8.1 },
  manga: { reading: 1, completed: 2, onHold: 3, dropped: 4, planToRead: 5, totalEntries: 15, chaptersRead: 50, volumesRead: 10, meanScore: 7.2 },
};
const favorites = {
  anime: [{ mal_id: 1, title: 'Cowboy Bebop', url: 'https://myanimelist.net/anime/1', type: 'TV', imageUrl: 'https://cdn.myanimelist.net/a.jpg' }],
  manga: [], characters: [{ mal_id: 3, name: 'Spike', url: 'https://myanimelist.net/character/3', imageUrl: null }], people: [],
};
const updates = {
  anime: [{ entry: { mal_id: 1, title: 'Cowboy Bebop', imageUrl: null }, score: 9, status: 'watching', progress: 3, total: 26, date: 'Jan 1' }],
  manga: [],
};

vi.mock('../../src/services/user.service', () => ({
  UserService: class {
    async profile() { return served(profile); }
    async statistics() { return served(statistics); }
    async favoritesFor() { return served(favorites); }
    async userUpdates() { return served(updates); }
    async about() { return served({ about: 'hi' }); }
    async fullProfile() { return served({ profile, statistics, favorites, updates }); }
    async friends() { return served([{ username: 'friend', imageUrl: null, lastOnline: 'Now', friendsSince: 'Jan 2021' }]); }
    async clubs() { return served([{ malId: 12, name: 'Club', url: 'https://myanimelist.net/clubs.php?cid=12' }]); }
    async reviews() { return served([]); }
    async recommendations() { return served([]); }
  },
}));
vi.mock('../../src/services/search.service', () => ({
  SearchService: class {
    async users() { return served([{ username: 'amayacrab', url: 'https://myanimelist.net/profile/amayacrab', avatarUrl: null, joinedAt: 'Feb 2020' }]); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('users routes in Jikan shape', () => {
  it('serves a profile', async () => {
    const { response, body } = await get('/v1/users/amayacrab');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ username: 'amayacrab', url: profile.profileUrl, gender: 'Female' });
    expect(body.data.images.jpg.image_url).toBe(profile.avatarUrl);
    // MAL exposes no numeric id on a profile page, so Jikan's mal_id is honestly null.
    expect(body.data.mal_id).toBeNull();
    expect(body.data.last_online).toBe('Now');
  });

  it('serves statistics with Jikan field names', async () => {
    const { body } = await get('/v1/users/amayacrab/statistics');
    expectNoCamelCase(body.data);
    expect(body.data.anime).toMatchObject({ mean_score: 8.1, on_hold: 3, plan_to_watch: 5, total_entries: 15, episodes_watched: 100 });
    expect(body.data.manga).toMatchObject({ plan_to_read: 5, chapters_read: 50, volumes_read: 10 });
    for (const key of ['days_watched', 'rewatched']) expect(body.data.anime).toHaveProperty(key, null);
  });

  it('serves favorites, updates, about and the combined full profile', async () => {
    for (const path of ['/v1/users/amayacrab/favorites', '/v1/users/amayacrab/userupdates', '/v1/users/amayacrab/full', '/v1/users/amayacrab/about']) {
      const { body } = await get(path);
      expectNoCamelCase(body.data);
    }
    const { body: favs } = await get('/v1/users/amayacrab/favorites');
    expect(favs.data.anime[0]).toMatchObject({ mal_id: 1, type: 'TV' });
    expect(favs.data.anime[0].images.jpg.image_url).toBeTruthy();
    const { body: upd } = await get('/v1/users/amayacrab/userupdates');
    expect(upd.data.anime[0].entry).toHaveProperty('mal_id', 1);
  });

  it('serves the list-shaped social routes', async () => {
    for (const path of ['/v1/users/amayacrab/friends', '/v1/users/amayacrab/clubs', '/v1/users/amayacrab/reviews', '/v1/users/amayacrab/recommendations']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body } = await get('/v1/users/amayacrab/clubs');
    expect(body.data[0]).toMatchObject({ mal_id: 12, name: 'Club' });
  });

  it('serves user search with pagination', async () => {
    const { body } = await get('/v1/users?q=amaya&page=2');
    expectListEnvelope(body);
    expect(body.pagination.current_page).toBe(2);
    expect(body.data[0].username).toBe('amayacrab');
  });
});
