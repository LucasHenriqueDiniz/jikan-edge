import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTopAnime } from '../../src/parsers/top-anime.parser';

const html = readFileSync('tests/fixtures/anime/top-anime-page1.html', 'utf8');

describe('top anime parser', () => {
  it('extracts ranked entries from a MAL-paginated page', () => {
    const entries = parseTopAnime(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      malId: 52991,
      title: 'Sousou no Frieren',
      score: 9.25,
      type: 'TV',
      episodes: 28,
      members: 1_487_685,
    });
    expect(entries[1]).toMatchObject({ malId: 1, title: 'Cowboy Bebop', score: 8.75 });
  });
});
