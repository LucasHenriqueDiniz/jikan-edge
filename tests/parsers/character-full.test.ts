import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterFull } from '../../src/parsers/character-full.parser';

const html = readFileSync('tests/fixtures/characters/full-valid.html', 'utf8');

describe('character full parser', () => {
  it('combines detail fields with animeography, mangaography, and voice actors', () => {
    const full = parseCharacterFull(html, 1, '2026-07-26T00:00:00.000Z');
    expect(full.malId).toBe(1);
    expect(full.name).toBe('Spike Spiegel');
    expect(full.favorites).toBe(49189);
    expect(full.anime).toEqual([
      { malId: 1, title: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/r/42x62/images/anime/4/19644.jpg?s=42d7666179a2851c99fada2e0ceb5da1', role: 'Main' },
    ]);
    expect(full.manga).toEqual([
      { malId: 173, title: 'Cowboy Bebop', imageUrl: 'https://cdn.myanimelist.net/r/42x62/images/manga/3/166652.jpg?s=11de80d1d5c75e063332dbe842bf', role: 'Main' },
    ]);
    expect(full.voices).toEqual([
      { malId: 11, name: 'Yamadera, Kouichi', imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/1/23960.jpg', language: 'Japanese' },
    ]);
  });
});
