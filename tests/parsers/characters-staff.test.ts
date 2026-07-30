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
      { malId: 357, name: 'Ishizuka, Unshou', language: 'Japanese', imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/2/17135.jpg' },
    ]);
  });

  it('extracts anime staff', () => {
    const staff = parseStaff(animeHtml);
    expect(staff).toEqual([
      { malId: 77978, name: 'Ikeguchi, Kazuhiko', imageUrl: 'https://cdn.myanimelist.net/images/questionmark_23.gif', role: 'Producer' },
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
});
