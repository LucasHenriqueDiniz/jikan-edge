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
    expect(detail.genres).toEqual(['Action', 'Drama']);
    expect(detail.themes).toEqual(['Gore']);
    expect(detail.demographics).toEqual(['Seinen']);
    expect(detail.authors).toEqual(['Miura, Kentarou']);
    expect(detail.serialization).toBe('Young Animal');
    expect(detail.relations).toEqual([{ relation: 'Adaptation', type: 'anime', malId: 1, title: 'Cowboy Bebop' }]);
    expect(detail.externalLinks).toEqual([{ name: 'Official Site', url: 'https://www.dark-horse.com/' }]);
  });
});
