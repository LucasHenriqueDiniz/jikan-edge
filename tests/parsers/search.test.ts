import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeSearchResults, parseMangaSearchResults } from '../../src/parsers/search.parser';

const animeHtml = readFileSync('tests/fixtures/search/anime-valid.html', 'utf8');
// A real row for a *finished* manga: the middle column only carries a number once the run is over,
// and that is precisely the case this API used to publish under `episodes`.
const mangaHtml = readFileSync('tests/fixtures/search/manga-valid.html', 'utf8');

describe('anime search parser', () => {
  it('extracts search result entries', () => {
    const entries = parseAnimeSearchResults(animeHtml);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      malId: 1735,
      title: 'Naruto: Shippuuden',
      type: 'TV',
      episodes: 500,
      score: 8.29,
    });
    expect(entries[0].imageUrl).toContain('cdn.myanimelist.net');
    expect(entries[0].synopsis).toContain('It has been two and a half years');
    expect(entries[0].synopsis).not.toContain('read more');
  });

  it('links back to the entry with the slug MAL uses', () => {
    expect(parseAnimeSearchResults(animeHtml)[0].url).toBe('https://myanimelist.net/anime/1735/Naruto__Shippuuden');
  });

  it('returns an empty array when there are no results, without throwing', () => {
    expect(parseAnimeSearchResults('<html><body>no matches</body></html>')).toEqual([]);
  });
});

describe('manga search parser', () => {
  it('reads the middle column as volumes, not episodes', () => {
    const entries = parseMangaSearchResults(mangaHtml);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      malId: 25,
      title: 'Fullmetal Alchemist',
      type: 'Manga',
      volumes: 27,
    });
    // The detail page reads 27 volumes / 116 chapters — 27 is the volume count, and calling it
    // `episodes` (as the shared anime shape did) was publishing the wrong label for a real number.
    expect(entries[0]).not.toHaveProperty('episodes');
    expect(entries[0].url).toBe('https://myanimelist.net/manga/25/Fullmetal_Alchemist');
  });
});
