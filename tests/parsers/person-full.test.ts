import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePersonFull } from '../../src/parsers/person-full.parser';

const html = readFileSync('tests/fixtures/people/full-valid.html', 'utf8');

describe('person full parser', () => {
  it('combines detail fields with anime staff, manga, and voice acting roles', () => {
    const full = parsePersonFull(html, 11, '2026-07-26T00:00:00.000Z');
    expect(full.malId).toBe(11);
    expect(full.name).toBe('Yamadera, Kouichi');
    expect(full.anime).toEqual([]);
    expect(full.manga).toEqual([]);
    expect(full.voices).toEqual([
      {
        animeId: 1, animeTitle: 'Cowboy Bebop', animeImageUrl: 'https://cdn.myanimelist.net/r/84x124/images/anime/4/19644.jpg?s=42d7666179a2851c99fada2e0ceb5da1',
        characterId: 1, characterName: 'Spiegel, Spike', characterRole: 'Main', characterImageUrl: 'https://cdn.myanimelist.net/r/84x124/images/characters/11/516853.jpg',
      },
    ]);
  });
});
