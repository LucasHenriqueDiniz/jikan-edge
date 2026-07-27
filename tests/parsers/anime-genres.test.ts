import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeGenres } from '../../src/parsers/anime-genres.parser';

const html = readFileSync('tests/fixtures/anime/genres-valid.html', 'utf8');

describe('anime genres parser', () => {
  it('extracts a deduplicated, sorted genre taxonomy', () => {
    const genres = parseAnimeGenres(html);
    expect(genres[0]).toEqual({ malId: 1, name: 'Action', url: 'https://myanimelist.net/anime/genre/1/Action' });
    expect(genres[1]).toEqual({ malId: 2, name: 'Adventure', url: 'https://myanimelist.net/anime/genre/2/Adventure' });
    expect(genres.map((g) => g.malId)).toEqual([...genres.map((g) => g.malId)].sort((a, b) => a - b));
    expect(genres.length).toBeGreaterThanOrEqual(20);
  });

  it('rejects an implausibly short genre list (MAL serving a reduced sidebar)', () => {
    const shortHtml = '<span class="genre"> <a href="/anime/genre/1/Action" title="Action">Action</a> </span>';
    expect(() => parseAnimeGenres(shortHtml)).toThrow('invalid_genre_list');
  });
});
