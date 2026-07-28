import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';

const html = readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8');

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
    expect(detail.genres).toEqual([
      { malId: 1, name: 'Action', url: 'https://myanimelist.net/manga/genre/1/Action' },
      { malId: 8, name: 'Drama', url: 'https://myanimelist.net/manga/genre/8/Drama' },
    ]);
    expect(detail.themes.map((theme) => theme.name)).toEqual(['Gore']);
    expect(detail.demographics.map((demographic) => demographic.name)).toEqual(['Seinen']);
    // Authors link to /people/, so the ref points at the person page, not a genre page.
    expect(detail.authors).toEqual([{ malId: 1868, name: 'Miura, Kentarou', url: 'https://myanimelist.net/people/1868/Kentarou_Miura' }]);
    expect(detail.serialization).toBe('Young Animal');
    expect(detail.relations).toEqual([{ relation: 'Adaptation', type: 'anime', malId: 1, title: 'Cowboy Bebop' }]);
    expect(detail.externalLinks).toEqual([{ name: 'Official Site', url: 'https://www.dark-horse.com/' }]);
  });
});
