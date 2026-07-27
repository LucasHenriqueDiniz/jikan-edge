import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTitleRecommendations } from '../../src/parsers/title-recommendations.parser';

const html = readFileSync('tests/fixtures/recommendations/anime-title-recs-valid.html', 'utf8');

describe('title recommendations parser', () => {
  it('extracts recommended-title entries with an accurate vote count', () => {
    const entries = parseTitleRecommendations(html, 'anime');
    expect(entries).toEqual([
      { malId: 205, title: 'Samurai Champloo', imageUrl: 'https://cdn.myanimelist.net/r/50x70/images/anime/1370/135212.jpg?s=057b95e4f0325310cd6c3747123e7c3b', votes: 122 },
      { malId: 889, title: 'Baccano!', imageUrl: 'https://cdn.myanimelist.net/r/50x70/images/anime/13/75893.jpg?s=abc', votes: 1 },
    ]);
  });
});
