import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterSearch } from '../../src/parsers/character-search.parser';

const html = readFileSync('tests/fixtures/characters/search-valid.html', 'utf8');

describe('character search parser', () => {
  it('extracts character entries', () => {
    const results = parseCharacterSearch(html);
    expect(results).toEqual([
      { malId: 33110, name: 'Spike', url: 'https://myanimelist.net/character/33110/Spike', imageUrl: 'https://cdn.myanimelist.net/images/characters/15/241595.jpg' },
      { malId: 1, name: 'Spiegel, Spike', url: 'https://myanimelist.net/character/1/Spike_Spiegel', imageUrl: 'https://cdn.myanimelist.net/images/characters/11/516853.jpg' },
    ]);
  });
});
