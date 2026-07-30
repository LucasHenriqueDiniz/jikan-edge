import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePersonAnimeStaff, parsePersonManga, parsePersonVoiceActingRoles } from '../../src/parsers/person-media.parser';

const html = readFileSync('tests/fixtures/people/media-valid.html', 'utf8');

describe('person media parser', () => {
  it('extracts anime staff positions', () => {
    expect(parsePersonAnimeStaff(html)).toEqual([
      { animeId: 1, animeTitle: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg', positions: ['Director', 'Screenplay'] },
    ]);
  });

  it('extracts published manga credits', () => {
    expect(parsePersonManga(html)).toEqual([
      { mangaId: 173, mangaTitle: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/images/manga/5/166652.jpg', positions: ['Story & Art'] },
    ]);
  });

  it('extracts voice acting roles', () => {
    expect(parsePersonVoiceActingRoles(html)).toEqual([
      {
        animeId: 1, animeTitle: 'Cowboy Bebop', animeImageUrl: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg',
        characterId: 2, characterName: 'Narrator', characterRole: 'Supporting', characterImageUrl: 'https://cdn.myanimelist.net/images/characters/1/1.jpg',
      },
    ]);
  });
});
