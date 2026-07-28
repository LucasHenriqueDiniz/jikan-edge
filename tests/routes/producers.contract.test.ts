import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const detail = {
  malId: 14, name: 'Sunrise', imageUrl: 'https://cdn.myanimelist.net/images/company/1.png',
  established: 'Sep 1972', favorites: 1200, fetchedAt: '2026-07-28T00:00:00.000Z', sourceVersion: 'test',
};

vi.mock('../../src/services/producer.service', () => ({
  ProducerService: class {
    async detail() { return served(detail); }
    async full() { return served({ ...detail, about: 'Studio.', external: [{ name: 'Official site', url: 'https://sunrise-inc.co.jp' }] }); }
    async external() { return served([{ name: 'Official site', url: 'https://sunrise-inc.co.jp' }]); }
    async list() { return served([{ malId: 14, name: 'Sunrise', count: 300, url: 'https://myanimelist.net/anime/producer/14' }]); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('producers routes in Jikan shape', () => {
  it('serves a producer detail', async () => {
    const { response, body } = await get('/v1/producers/14');
    expect(response.status).toBe(200);
    expectNoCamelCase(body.data);
    expect(body.data).toMatchObject({ mal_id: 14, established: 'Sep 1972', favorites: 1200 });
    // Producers live under /anime/producer/, not /producer/.
    expect(body.data.url).toBe('https://myanimelist.net/anime/producer/14');
    expect(body.data.titles).toContainEqual({ type: 'Default', title: 'Sunrise' });
    expect(body.data.images.jpg.image_url).toContain('cdn.myanimelist.net');
  });

  it('serves full and external', async () => {
    const { body: full } = await get('/v1/producers/14/full');
    expectNoCamelCase(full.data);
    expect(full.data.mal_id).toBe(14);
    expect(full.data.about).toBe('Studio.');
    expect(full.data.external[0]).toEqual({ name: 'Official site', url: 'https://sunrise-inc.co.jp' });

    const { body: external } = await get('/v1/producers/14/external');
    expectListEnvelope(external);
    expect(external.data[0]).toEqual({ name: 'Official site', url: 'https://sunrise-inc.co.jp' });
  });

  it('serves the producer directory', async () => {
    const { body } = await get('/v1/producers?q=sun');
    expectListEnvelope(body);
    expect(body.data[0]).toMatchObject({ mal_id: 14, count: 300 });
  });
});
