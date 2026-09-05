import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';

const html = readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8');
// Captured verbatim from myanimelist.net/manga/2 — the synthetic fixture above has none of the
// markup the newer fields live in.
const realHtml = readFileSync('tests/fixtures/manga/detail-real.html', 'utf8');

describe('manga detail parser', () => {
  it('normalizes a public manga detail page', () => {
    const detail = parseMangaDetail(html, 2, '2026-07-26T00:00:00.000Z');
    expect(detail.title).toBe('Berserk');
    expect(detail.titleEnglish).toBe('Berserk');
    expect(detail.imageUrl).toContain('cdn.myanimelist.net');
    expect(detail.type).toBe('Manga');
    expect(detail.status).toBe('Publishing');
    expect(detail.score).toBe(9.46);
    expect(detail.rank).toBe(1);
    expect(detail.popularity).toBe(1);
    expect(detail.members).toBe(804_371);
    expect(detail.genres.map((ref) => ref.name)).toEqual(['Action', 'Drama']);
    expect(detail.themes.map((ref) => ref.name)).toEqual(['Gore']);
    expect(detail.demographics.map((ref) => ref.name)).toEqual(['Seinen']);
    expect(detail.authors.map((ref) => ref.name)).toEqual(['Miura, Kentarou']);
    expect(detail.serializations.map((ref) => ref.name)).toEqual(['Young Animal']);
    expect(detail.relations).toEqual([{ relation: 'Adaptation', type: 'anime', malId: 1, title: 'Cowboy Bebop' }]);
    expect(detail.externalLinks).toEqual([{ name: 'Official Site', url: 'https://www.dark-horse.com/' }]);
  });

  describe('against markup copied from the live page', () => {
    const detail = parseMangaDetail(realHtml, 2, '2026-07-30T00:00:00.000Z');

    it('carries the canonical URL and the vote count', () => {
      expect(detail.url).toBe('https://myanimelist.net/manga/2/Berserk');
      expect(detail.scoredBy).toBeGreaterThan(100_000);
    });

    it('keeps the MAL id on authors, magazines and every taxonomy', () => {
      expect(detail.authors[0]).toEqual({
        malId: 1868,
        name: 'Miura, Kentarou',
        url: 'https://myanimelist.net/people/1868/Kentarou_Miura',
      });
      // MAL lists more than one magazine for some titles, which the old singular `serialization`
      // string could never represent.
      expect(detail.serializations[0]).toEqual({
        malId: 2,
        name: 'Young Animal',
        url: 'https://myanimelist.net/manga/magazine/2/Young_Animal',
      });
      expect(detail.demographics.map((ref) => ref.malId)).toEqual([41]);
    });

    it('splits the published range and leaves an open end null', () => {
      // Berserk is unfinished: MAL prints "Aug 25, 1989 to ?".
      expect(detail.published.from).toBe('1989-08-25');
      expect(detail.published.to).toBeNull();
      expect(detail.published.string).toBe('Aug 25, 1989 to ?');
      expect(detail.publishing).toBe(true);
    });
  });
});
