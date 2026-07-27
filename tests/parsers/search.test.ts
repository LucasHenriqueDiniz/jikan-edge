import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSearchResults } from '../../src/parsers/search.parser';

const html = readFileSync('tests/fixtures/search/anime-valid.html', 'utf8');

describe('search parser', () => {
  it('extracts search result entries', () => {
    const entries = parseSearchResults(html);
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

  it('returns an empty array when there are no results, without throwing', () => {
    expect(parseSearchResults('<html><body>no matches</body></html>')).toEqual([]);
  });
});
