import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const staff = [{ username: 'owner', url: 'https://myanimelist.net/profile/owner', role: 'Admin' }];
const detail = {
  malId: 12, title: 'Cowboy Bebop Club', members: 5000, pictures: 10, category: 'anime',
  created: 'Jan 1, 2005', staff, fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};

vi.mock('../../src/services/club.service', () => ({
  ClubService: class {
    async detail() { return served(detail); }
    async staff() { return served(staff); }
    async members() { return served([{ username: 'member', url: 'https://myanimelist.net/profile/member', avatarUrl: 'https://cdn.myanimelist.net/m.jpg' }]); }
    async list() { return served([{ malId: 12, title: 'Cowboy Bebop Club', imageUrl: null, description: 'A club', members: 5000 }]); }
    async relations() {
      return served({ anime: [{ malId: 1, title: 'Cowboy Bebop' }], manga: [], characters: [{ malId: 1, name: 'Spike Spiegel' }] });
    }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('clubs routes in Jikan shape', () => {
  it('serves a club detail', async () => {
    const { response, body } = await get('/v1/clubs/12');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ mal_id: 12, name: 'Cowboy Bebop Club', members: 5000, category: 'anime' });
    // MAL serves clubs from `clubs.php?cid=`, not `/clubs/{id}` — a link built off the generic
    // `/{type}/{id}` pattern 404s.
    expect(body.data.url).toBe('https://myanimelist.net/clubs.php?cid=12');
    // Jikan keeps staff on its own endpoint; the detail document does not carry it.
    expect(body.data).not.toHaveProperty('staff');
  });

  it('serves staff, members and relations', async () => {
    const { body: staffBody } = await get('/v1/clubs/12/staff');
    expectListEnvelope(staffBody);
    expect(staffBody.data[0].username).toBe('owner');

    const { body: members } = await get('/v1/clubs/12/members?page=2');
    expectListEnvelope(members);
    expect(members.pagination.current_page).toBe(2);
    expect(members.data[0].images.jpg.image_url).toBe('https://cdn.myanimelist.net/m.jpg');

    const { body: relations } = await get('/v1/clubs/12/relations');
    expectNoCamelCase(relations.data);
    expect(relations.data.anime[0]).toMatchObject({ mal_id: 1, type: 'anime', name: 'Cowboy Bebop' });
    expect(relations.data.characters[0]).toMatchObject({ mal_id: 1, type: 'character', name: 'Spike Spiegel' });
    expect(relations.data.manga).toEqual([]);
  });

  it('serves the club index with pagination', async () => {
    const { body } = await get('/v1/clubs?page=2');
    expectListEnvelope(body);
    expect(body.pagination.current_page).toBe(2);
    expect(body.data[0]).toMatchObject({ mal_id: 12, name: 'Cowboy Bebop Club', members: 5000 });
  });
});
