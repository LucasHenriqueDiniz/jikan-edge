import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMangaGenres } from '../../src/parsers/manga-genres.parser';

const html = readFileSync('tests/fixtures/manga/genres-valid.html', 'utf8');

describe('manga genres parser', () => {
  it('extracts a sorted genre taxonomy', () => {
    const genres = parseMangaGenres(html);
    expect(genres[0]).toEqual({ malId: 1, name: 'Action', url: 'https://myanimelist.net/manga/genre/1/Action' });
    expect(genres[1]).toEqual({ malId: 2, name: 'Adventure', url: 'https://myanimelist.net/manga/genre/2/Adventure' });
    expect(genres.length).toBeGreaterThanOrEqual(20);
  });

  it('rejects an implausibly short genre list (MAL serving a reduced sidebar)', () => {
    const shortHtml = '<span class="genre"> <a href="/manga/genre/1/Action" title="Action">Action</a> </span>';
    expect(() => parseMangaGenres(shortHtml)).toThrow('invalid_genre_list');
  });
});
