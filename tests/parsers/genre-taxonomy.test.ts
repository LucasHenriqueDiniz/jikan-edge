import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGenreTaxonomy } from '../../src/parsers/genre-taxonomy.parser';

const animeHtml = readFileSync('tests/fixtures/anime/genre-taxonomy.html', 'utf8');
const mangaHtml = readFileSync('tests/fixtures/manga/genre-taxonomy.html', 'utf8');

describe('genre taxonomy parser', () => {
  it('reads the full anime taxonomy with category and count', () => {
    const genres = parseGenreTaxonomy(animeHtml, 'anime');
    expect(genres).toHaveLength(78);
    expect(genres[0]).toEqual({
      malId: 1,
      name: 'Action',
      url: 'https://myanimelist.net/anime/genre/1/Action',
      count: 5003,
      type: 'genres',
    });
    expect(genres.find((entry) => entry.malId === 12)).toEqual({
      malId: 12,
      name: 'Hentai',
      url: 'https://myanimelist.net/anime/genre/12/Hentai',
      count: 1634,
      type: 'explicit_genres',
    });
    expect(genres.find((entry) => entry.malId === 27)).toMatchObject({ name: 'Shounen', type: 'demographics' });
    const byKind = genres.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.type] = (acc[entry.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind).toEqual({ genres: 18, explicit_genres: 3, themes: 52, demographics: 5 });
  });

  it('reads the manga taxonomy and points its urls at the manga tree', () => {
    const genres = parseGenreTaxonomy(mangaHtml, 'manga');
    expect(genres).toHaveLength(79);
    expect(genres[0]).toEqual({
      malId: 1,
      name: 'Action',
      url: 'https://myanimelist.net/manga/genre/1/Action',
      count: 11296,
      type: 'genres',
    });
    expect(genres.every((entry) => entry.url.startsWith('https://myanimelist.net/manga/genre/'))).toBe(true);
  });

  it('splits the count off a name that has parentheses of its own', () => {
    const genres = parseGenreTaxonomy(animeHtml, 'anime');
    expect(genres.find((entry) => entry.malId === 60)).toEqual({
      malId: 60,
      name: 'Idols (Female)',
      url: 'https://myanimelist.net/anime/genre/60/Idols_(Female)',
      count: 417,
      type: 'themes',
    });
  });

  it('rejects a document that is missing a whole category', () => {
    const themesOnly = animeHtml.slice(0, animeHtml.indexOf('category-type">Themes'));
    expect(() => parseGenreTaxonomy(themesOnly, 'anime')).toThrow('incomplete_genre_taxonomy');
  });

  it('rejects a reduced taxonomy instead of caching it as complete', () => {
    const firstEntries = animeHtml.slice(0, animeHtml.indexOf('<p>Comedy'));
    expect(() => parseGenreTaxonomy(firstEntries, 'anime')).toThrow('incomplete_genre_taxonomy');
  });

  it('rejects a page without the content filter block', () => {
    expect(() => parseGenreTaxonomy('<html><body>Genres</body></html>', 'anime')).toThrow('genre_taxonomy_not_found');
  });
});
