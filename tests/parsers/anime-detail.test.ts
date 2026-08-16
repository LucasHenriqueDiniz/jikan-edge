import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';

const html = readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8');
const singularLabelsHtml = readFileSync('tests/fixtures/anime/detail-singular-labels.html', 'utf8');
// Captured verbatim from myanimelist.net/anime/1 — the trimmed synthetic fixture above carries
// none of the markup the newer fields live in (og:url, Premiered, ratingCount, Background).
const realHtml = readFileSync('tests/fixtures/anime/detail-real.html', 'utf8');

describe('anime detail parser', () => {
  it('normalizes a public anime detail page', () => {
    const detail = parseAnimeDetail(html, 1, '2026-07-19T00:00:00.000Z');
    expect(detail.title).toBe('Cowboy Bebop');
    expect(detail.titleEnglish).toBe('Cowboy Bebop');
    expect(detail.imageUrl).toBe('https://cdn.myanimelist.net/images/anime/4/19644.jpg');
    // Anime carries both CDN variants; `medium` is always the same URL as `imageUrl`.
    expect(detail.images).toEqual({
      small: 'https://cdn.myanimelist.net/images/anime/4/19644t.jpg',
      medium: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg',
      large: 'https://cdn.myanimelist.net/images/anime/4/19644l.jpg',
    });
    expect(detail.episodes).toBe(26);
    expect(detail.score).toBe(8.75);
    expect(detail.rank).toBe(50);
    expect(detail.popularity).toBe(41);
    expect(detail.members).toBe(2_074_721);
    expect(detail.genres.map((ref) => ref.name)).toEqual(['Action', 'Award Winning']);
    expect(detail.themes.map((ref) => ref.name)).toEqual(['Adult Cast', 'Space']);
    expect(detail.studios.map((ref) => ref.name)).toEqual(['Sunrise']);
    expect(detail.relations).toEqual([{ relation: 'Adaptation', type: 'manga', malId: 174, title: 'Shooting Star Bebop: Cowboy Bebop' }]);
    expect(detail.externalLinks).toEqual([
      { name: 'Official Site', url: 'http://www.cowboy-bebop.net/' },
      { name: 'AniDB', url: 'https://anidb.net/perl-bin/animedb.pl?show=anime&aid=23' },
    ]);
    expect(detail.streaming).toEqual([
      { name: 'Crunchyroll', url: 'http://www.crunchyroll.com/series-271225', available: true },
      { name: 'Netflix', url: 'https://www.netflix.com/title/80001305', available: false },
    ]);
  });

  describe('against markup copied from the live page', () => {
    const detail = parseAnimeDetail(realHtml, 1, '2026-07-30T00:00:00.000Z');

    it('carries the canonical URL, with the slug MAL uses', () => {
      expect(detail.url).toBe('https://myanimelist.net/anime/1/Cowboy_Bebop');
    });

    it('keeps the MAL id on every taxonomy reference, closing the loop with ?genres=', () => {
      expect(detail.genres[0]).toEqual({
        malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action',
      });
      // The ids are the ones `GET /v1/anime?genres=` takes, and the ones /v1/genres/anime lists.
      expect(detail.genres.map((ref) => ref.malId)).toEqual([1, 46, 24]);
      expect(detail.studios).toEqual([
        { malId: 14, name: 'Sunrise', url: 'https://myanimelist.net/anime/producer/14/Sunrise' },
      ]);
      expect(detail.licensors.map((ref) => ref.name)).toEqual(['Funimation']);
      expect(detail.producers.map((ref) => ref.malId)).toContain(23);
    });

    it('reports how many votes are behind the score', () => {
      expect(detail.score).toBe(8.75);
      expect(detail.scoredBy).toBeGreaterThan(1_000_000);
    });

    it('splits the aired range into dates while keeping MAL\'s own wording', () => {
      expect(detail.aired).toEqual({
        from: '1998-04-03',
        to: '1999-04-24',
        string: 'Apr 3, 1998 to Apr 24, 1999',
      });
    });

    it('reads the premiere season and the broadcast slot', () => {
      expect(detail.season).toBe('spring');
      expect(detail.year).toBe(1998);
      expect(detail.broadcast).toEqual({
        day: 'Saturdays', time: '01:00', timezone: 'JST', string: 'Saturdays at 01:00 (JST)',
      });
    });

    it('derives airing from the status text', () => {
      expect(detail.status).toBe('Finished Airing');
      expect(detail.airing).toBe(false);
    });

    it('extracts the trailer and builds the watch URL from its id', () => {
      expect(detail.trailer.youtubeId).toBe('gY5nDXOtv_o');
      expect(detail.trailer.url).toBe('https://www.youtube.com/watch?v=gY5nDXOtv_o');
      expect(detail.trailer.embedUrl).toContain('youtube-nocookie.com/embed/gY5nDXOtv_o');
    });

    it('picks up the curated Background section', () => {
      expect(detail.background).toContain('first aired in spring of 1998 on TV Tokyo');
    });

    // The next section's "Edit" link sits before its own <h2>, so a cut anchored only on the
    // heading dragged it into the Background text.
    it('stops the Background before the next section\'s Edit link', () => {
      expect(detail.background).toMatch(/gateway drug.+anime aimed at adult audiences\.$/s);
    });

    it('keeps the synopsis paragraphs', () => {
      expect(detail.synopsis).toContain('\n\n');
    });
  });

  it('handles MAL pages that use singular Genre:/Studio: labels', () => {
    const detail = parseAnimeDetail(singularLabelsHtml, 33352, '2026-07-19T00:00:00.000Z');
    expect(detail.title).toBe('Violet Evergarden');
    expect(detail.genres.map((ref) => ref.name)).toEqual(['Drama', 'Fantasy']);
    expect(detail.studios.map((ref) => ref.name)).toEqual(['Kyoto Animation']);
    expect(detail.themes).toEqual([]);
  });
});
