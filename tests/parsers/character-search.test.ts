import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterSearch } from '../../src/parsers/character-search.parser';

const html = readFileSync('tests/fixtures/characters/search-valid.html', 'utf8');

describe('character search parser', () => {
  it('extracts character entries', () => {
    const results = parseCharacterSearch(html);
    expect(results).toEqual([
      { malId: 33110, name: 'Spike', url: 'https://myanimelist.net/character/33110/Spike', imageUrl: 'https://cdn.myanimelist.net/r/42x62/images/characters/15/241595.jpg?s=0b5256642dcc889f98b0cd97b40757ed' },
      { malId: 1, name: 'Spiegel, Spike', url: 'https://myanimelist.net/character/1/Spike_Spiegel', imageUrl: 'https://cdn.myanimelist.net/r/42x62/images/characters/11/516853.jpg?s=c73c8218a6f307bfb0b4e5e35029991a' },
    ]);
  });
});
