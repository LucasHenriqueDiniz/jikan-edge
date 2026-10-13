import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeSearchResults, parseMangaSearchResults, resultDate } from '../../src/parsers/search.parser';

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

// The results tables as MAL returns them when every column is requested (`c[]=a…g`), contiguous
// excerpts of real searches fetched through Cloudflare's network on 2026-10-11.
describe('extra result columns', () => {
  const anime = parseAnimeSearchResults(readFileSync('tests/fixtures/search/anime-columns-real.html', 'utf8'));
  const manga = parseMangaSearchResults(readFileSync('tests/fixtures/search/manga-columns-real.html', 'utf8'));

  // Row 1 on the page reads: TV, 10, 8.84, 01-16-26, 03-27-26, 623,240, PG-13.
  it('reads dates, members and rating on an anime result, by column name', () => {
    expect(anime[0]).toMatchObject({
      malId: 59978,
      type: 'TV',
      episodes: 10,
      score: 8.84,
      startDate: '2026-01-16',
      endDate: '2026-03-27',
      members: 623_240,
      rating: 'PG-13',
    });
  });

  // The manga table puts Chapters between Volumes and Score. Read by position, Berserk's `-` chapters
  // would have been its score; by name, the score stays 9.46.
  it('reads chapters, dates and members on a manga result without shifting the score', () => {
    const berserk = manga.find((entry) => entry.malId === 2);
    expect(berserk).toMatchObject({
      type: 'Manga',
      volumes: null,
      chapters: null,
      score: 9.46,
      startDate: '1989-08-25',
      endDate: null,
      members: 811_713,
    });
  });

  it('parses every row of both tables', () => {
    expect(anime).toHaveLength(4);
    expect(manga).toHaveLength(16);
  });
});

describe('result dates', () => {
  const now = new Date('2026-10-11T00:00:00Z');

  // Search lists upcoming titles, so the century pivot sits five years ahead of today.
  it('reads a two-digit year up to five years ahead as this century', () => {
    expect(resultDate('01-16-26', now)).toBe('2026-01-16');
    expect(resultDate('04-01-31', now)).toBe('2031-04-01');
    expect(resultDate('08-25-89', now)).toBe('1989-08-25');
    expect(resultDate('04-03-32', now)).toBe('1932-04-03');
  });

  // `10-??-27` is how MAL prints an announced October 2027 (63816, Frieren: Ougonkyou-hen, 2026-10-11).
  it('keeps the parts MAL knows, at reduced precision', () => {
    expect(resultDate('10-??-27', now)).toBe('2027-10');
    expect(resultDate('??-??-27', now)).toBe('2027');
  });

  it('is null for a missing or malformed date rather than a guess', () => {
    expect(resultDate('-', now)).toBeNull();
    expect(resultDate(null, now)).toBeNull();
    expect(resultDate('13-??-27', now)).toBeNull();
  });
});
