import { describe, expect, it, vi } from 'vitest';
import { expectListEnvelope, expectNoCamelCase, requester, served } from './contract-support';

const review = {
  malId: 1, type: 'anime' as const, title: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/a.jpg',
  username: 'reviewer', date: 'Jan 1, 2024', tag: 'Recommended', score: 9, reviewText: 'Great.',
};
const recommendation = {
  malId: 1, type: 'anime' as const, title: 'Cowboy Bebop', imageUrl: null,
  recommendedMalId: 205, recommendedTitle: 'Samurai Champloo', recommendedImageUrl: null,
  content: 'Same director.', username: 'user',
};

vi.mock('../../src/services/watch.service', () => ({
  WatchService: class {
    async episodes() { return served([{ animeId: 1, animeTitle: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/a.jpg', episodes: ['Episode 1', 'Episode 2'] }]); }
    async promos() { return served([{ animeId: 1, animeTitle: 'Cowboy Bebop', imageUrl: null, title: 'PV 1', videoUrl: 'https://www.youtube.com/embed/abc123' }]); }
  },
}));
vi.mock('../../src/services/review.service', () => ({
  ReviewService: class {
    async anime() { return served([review]); }
    async manga() { return served([{ ...review, type: 'manga' as const }]); }
  },
}));
vi.mock('../../src/services/recommendation.service', () => ({
  RecommendationService: class {
    async anime() { return served([recommendation]); }
    async manga() { return served([{ ...recommendation, type: 'manga' as const }]); }
  },
}));
vi.mock('../../src/services/manga.service', () => ({
  MangaService: class {
    async magazines() { return served([{ malId: 1, name: 'Weekly Shounen Jump', count: 900, url: 'https://myanimelist.net/manga/magazine/1' }]); }
  },
}));

const { default: app } = await import('../../src/app');
const get = requester(app);

describe('watch, reviews, recommendations and magazines in Jikan shape', () => {
  it('serves the watch feeds', async () => {
    for (const path of ['/v1/watch/episodes', '/v1/watch/episodes/popular', '/v1/watch/promos', '/v1/watch/promos/popular']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body: episodes } = await get('/v1/watch/episodes');
    expect(episodes.data[0].entry).toMatchObject({ mal_id: 1, title: 'Cowboy Bebop' });
    expect(episodes.data[0].entry.images.jpg.image_url).toContain('cdn.myanimelist.net');

    const { body: promos } = await get('/v1/watch/promos');
    expect(promos.data[0].entry).toMatchObject({ mal_id: 1 });
    // A promo carries a real video, so unlike anime detail its trailer is populated.
    expect(promos.data[0].trailer).toMatchObject({ youtube_id: 'abc123', embed_url: 'https://www.youtube.com/embed/abc123' });
  });

  it('serves the global review feeds with pagination', async () => {
    for (const path of ['/v1/reviews/anime?page=2', '/v1/reviews/manga']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body } = await get('/v1/reviews/anime?page=2');
    expect(body.pagination.current_page).toBe(2);
    expect(body.data[0]).toMatchObject({ user: { username: 'reviewer' }, score: 9 });
    expect(body.data[0].entry).toMatchObject({ mal_id: 1, title: 'Cowboy Bebop' });
    expect(body.data[0].tags).toEqual(['Recommended']);
  });

  it('serves the global recommendation feeds', async () => {
    for (const path of ['/v1/recommendations/anime', '/v1/recommendations/manga?page=3']) {
      const { body } = await get(path);
      expectListEnvelope(body);
    }
    const { body } = await get('/v1/recommendations/anime');
    // Jikan pairs both sides of a recommendation under `entry`.
    expect(body.data[0].entry).toHaveLength(2);
    expect(body.data[0].entry[0]).toMatchObject({ mal_id: 1 });
    expect(body.data[0].entry[1]).toMatchObject({ mal_id: 205, title: 'Samurai Champloo' });
    expect(body.data[0].content).toBe('Same director.');
  });

  it('serves magazines', async () => {
    const { body } = await get('/v1/magazines');
    expectListEnvelope(body);
    expect(body.data[0]).toMatchObject({ mal_id: 1, name: 'Weekly Shounen Jump', count: 900 });
  });
});
