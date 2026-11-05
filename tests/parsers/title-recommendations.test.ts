import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTitleRecommendations } from '../../src/parsers/title-recommendations.parser';

const html = readFileSync('tests/fixtures/recommendations/anime-title-recs-valid.html', 'utf8');

describe('title recommendations parser', () => {
  it('extracts recommended-title entries with an accurate vote count', () => {
    const entries = parseTitleRecommendations(html, 'anime');
    expect(entries).toEqual([
      {
        malId: 205,
        title: 'Samurai Champloo',
        imageUrl: 'https://cdn.myanimelist.net/images/anime/1370/135212.jpg',
        votes: 122,
      },
      { malId: 889, title: 'Baccano!', imageUrl: 'https://cdn.myanimelist.net/images/anime/13/75893.jpg', votes: 1 },
    ]);
  });

  // Real pages (2026-11-05): anime 6891 and manga 175006, which nobody has recommended. 502 before.
  describe('a title with no recommendations', () => {
    const anime = readFileSync('tests/fixtures/recommendations/anime-no-recs-real.html', 'utf8');
    const manga = readFileSync('tests/fixtures/recommendations/manga-no-recs-real.html', 'utf8');

    it('is an empty list on anime and manga', () => {
      expect(parseTitleRecommendations(anime, 'anime')).toEqual([]);
      expect(parseTitleRecommendations(manga, 'manga')).toEqual([]);
    });

    it('is still an error without the notice', () => {
      const withoutNotice = anime.replace('No recommendations have been made for this title.', '');
      expect(() => parseTitleRecommendations(withoutNotice, 'anime')).toThrow('empty_title_recommendations_page');
    });

    it('is still an error when cards are there but none parse', () => {
      const broken = `${html.replaceAll('<strong>', '<b>')}${anime}`;
      expect(() => parseTitleRecommendations(broken, 'anime')).toThrow('empty_title_recommendations_page');
    });
  });
});
