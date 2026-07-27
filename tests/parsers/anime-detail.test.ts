import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';

const html = readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8');
const singularLabelsHtml = readFileSync('tests/fixtures/anime/detail-singular-labels.html', 'utf8');

describe('anime detail parser', () => {
  it('normalizes a public anime detail page', () => {
    const detail = parseAnimeDetail(html, 1, '2026-07-19T00:00:00.000Z');
    expect(detail.title).toBe('Cowboy Bebop');
    expect(detail.titleEnglish).toBe('Cowboy Bebop');
    expect(detail.imageUrl).toContain('cdn.myanimelist.net');
    expect(detail.episodes).toBe(26);
    expect(detail.score).toBe(8.75);
    expect(detail.rank).toBe(50);
    expect(detail.popularity).toBe(41);
    expect(detail.members).toBe(2_074_721);
    expect(detail.genres).toEqual(['Action', 'Award Winning']);
    expect(detail.themes).toEqual(['Adult Cast', 'Space']);
    expect(detail.studios).toEqual(['Sunrise']);
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

  it('handles MAL pages that use singular Genre:/Studio: labels', () => {
    const detail = parseAnimeDetail(singularLabelsHtml, 33352, '2026-07-19T00:00:00.000Z');
    expect(detail.title).toBe('Violet Evergarden');
    expect(detail.genres).toEqual(['Drama', 'Fantasy']);
    expect(detail.studios).toEqual(['Kyoto Animation']);
    expect(detail.themes).toEqual([]);
  });
});
