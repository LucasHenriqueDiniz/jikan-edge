import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseCharacterAnimeography,
  parseCharacterMangaography,
  parseCharacterVoiceActors,
} from '../../src/parsers/character-media.parser';

const html = readFileSync('tests/fixtures/characters/media-valid.html', 'utf8');

describe('character media parser', () => {
  it('extracts animeography entries', () => {
    expect(parseCharacterAnimeography(html)).toEqual([
      {
        malId: 1,
        title: 'Cowboy Bebop',
        imageUrl: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg',
        role: 'Main',
      },
      {
        malId: 5,
        title: 'Cowboy Bebop: Tengoku no Tobira',
        imageUrl: 'https://cdn.myanimelist.net/images/anime/1439/93480.jpg',
        role: 'Main',
      },
    ]);
  });

  it('extracts mangaography entries', () => {
    expect(parseCharacterMangaography(html)).toEqual([
      {
        malId: 173,
        title: 'Cowboy Bebop',
        imageUrl: 'https://cdn.myanimelist.net/images/manga/3/166652.jpg',
        role: 'Main',
      },
    ]);
  });

  it('extracts voice actor entries', () => {
    expect(parseCharacterVoiceActors(html)).toEqual([
      {
        malId: 11,
        name: 'Yamadera, Kouichi',
        imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/1/23960.jpg',
        language: 'Japanese',
      },
      {
        malId: 12,
        name: 'Blum, Steven',
        imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/3/45741.jpg',
        language: 'English',
      },
    ]);
  });
});
