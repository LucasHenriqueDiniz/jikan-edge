import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacters, parseStaff } from '../../src/parsers/characters-staff.parser';

const animeHtml = readFileSync('tests/fixtures/characters/anime-characters-valid.html', 'utf8');
const mangaHtml = readFileSync('tests/fixtures/characters/manga-characters-valid.html', 'utf8');

describe('characters and staff parser', () => {
  it('extracts anime characters with voice actors', () => {
    const characters = parseCharacters(animeHtml, 'anime');
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({ malId: 1, name: 'Spiegel, Spike', role: 'Main', favorites: 49_190 });
    expect(characters[0].voiceActors).toEqual([
      {
        malId: 357,
        name: 'Ishizuka, Unshou',
        language: 'Japanese',
        imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/2/17135.jpg',
      },
    ]);
  });

  it('extracts anime staff', () => {
    const staff = parseStaff(animeHtml);
    expect(staff).toEqual([
      {
        malId: 77978,
        name: 'Ikeguchi, Kazuhiko',
        imageUrl: 'https://cdn.myanimelist.net/images/questionmark_23.gif',
        role: 'Producer',
      },
    ]);
  });

  it('extracts manga characters without voice actors', () => {
    const characters = parseCharacters(mangaHtml, 'manga');
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({ malId: 423, name: 'Casca', role: 'Main', favorites: 4923 });
    expect(characters[0].voiceActors).toEqual([]);
  });

  it('returns an empty staff list when there is no Staff section', () => {
    expect(parseStaff(mangaHtml)).toEqual([]);
  });

  // Real pages (2026-11-05) of titles MAL has no characters for. They answered 502 before.
  describe('a title with no characters', () => {
    const animeNoStaff = readFileSync('tests/fixtures/characters/anime-no-characters-no-staff-real.html', 'utf8');
    const animeWithStaff = readFileSync('tests/fixtures/characters/anime-no-characters-with-staff-real.html', 'utf8');
    const mangaEmpty = readFileSync('tests/fixtures/characters/manga-no-characters-real.html', 'utf8');

    it('is an empty cast on anime, with the staff that is there', () => {
      expect(parseCharacters(animeNoStaff, 'anime')).toEqual([]);
      expect(parseStaff(animeNoStaff)).toEqual([]);
      // Anime 29955 has no characters but does have a director, which the 502 used to lose.
      expect(parseCharacters(animeWithStaff, 'anime')).toEqual([]);
      expect(parseStaff(animeWithStaff)).toEqual([
        {
          malId: 27513,
          name: 'Okawara, Ryo',
          imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/1/55049.jpg',
          role: 'Director',
        },
      ]);
    });

    it('is an empty cast on manga, whose notice is worded differently', () => {
      expect(parseCharacters(mangaEmpty, 'manga')).toEqual([]);
    });

    // Each medium's notice is its own: the anime wording on a manga page is not MAL saying "empty".
    it('is still an error without the notice for that medium', () => {
      expect(() => parseCharacters(animeNoStaff, 'manga')).toThrow('empty_characters_page');
      expect(() => parseCharacters(mangaEmpty, 'anime')).toThrow('empty_characters_page');
    });

    it('is still an error when character rows are there but none parse', () => {
      const broken = `${animeHtml.replaceAll('h3_character_name', 'h3_renamed')}${animeNoStaff}`;
      expect(() => parseCharacters(broken, 'anime')).toThrow('empty_characters_page');
    });
  });

  // Confirmed live against One Piece's characters page: the Staff section runs 543 KB past its
  // heading with no other heading in between (it's the last thing on the page before the footer).
  // A fixed byte budget silently dropped everything past it; this builds a section past the old
  // 80 KB cap out of the same real row shape MAL uses, to prove parseStaff no longer truncates.
  it('does not truncate a staff list larger than the old fixed byte budget', () => {
    const row = (id: number) =>
      `<tr><td><div class="picSurround"><a href="https://myanimelist.net/people/${id}/Some_Person"><img data-src="https://cdn.myanimelist.net/r/42x62/images/questionmark_23.gif"></a></div></td>` +
      `<td><a href="https://myanimelist.net/people/${id}/Some_Person">Person, Number ${id}</a><div class="spaceit_pad"><small>Producer</small></div></td></tr>`;
    const rowCount = 500; // ~500 * ~330 bytes/row comfortably clears the removed 80,000-byte cap
    const rows = Array.from({ length: rowCount }, (_, i) => row(100_000 + i)).join('\n');
    const html = `<h2 class="h2_overwrite">Staff</h2><table>${rows}</table></body></html>`;
    expect(html.length).toBeGreaterThan(80_000);

    const staff = parseStaff(html);
    expect(staff).toHaveLength(rowCount);
    expect(staff[staff.length - 1].malId).toBe(100_000 + rowCount - 1);
  });

  it('stops the staff section at the next heading instead of running past it', () => {
    const row =
      '<tr><td><a href="https://myanimelist.net/people/1/Someone">Someone</a><div class="spaceit_pad"><small>Producer</small></div></td></tr>';
    const html = `<h2 class="h2_overwrite">Staff</h2><table>${row}</table><h2>Some Other Section</h2><table><tr><td><a href="https://myanimelist.net/people/2/Other">Other</a></td></tr></table>`;
    expect(parseStaff(html)).toEqual([{ malId: 1, name: 'Someone', imageUrl: null, role: 'Producer' }]);
  });
});
