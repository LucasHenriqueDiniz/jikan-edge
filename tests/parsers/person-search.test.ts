import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePersonSearch } from '../../src/parsers/person-search.parser';

describe('person search parser', () => {
  it('extracts person entries', () => {
    const html = readFileSync('tests/fixtures/people/search-valid.html', 'utf8');
    const results = parsePersonSearch(html);
    expect(results).toEqual([
      { malId: 46255, name: 'Miyazaki, Yuu', url: 'https://myanimelist.net/people/46255/Yuu_Miyazaki', imageUrl: 'https://cdn.myanimelist.net/r/23x32/images/voiceactors/3/76149.jpg?s=45a54f377835e224476d1039ce6726b5' },
      { malId: 1055, name: 'Miyazaki, Aoi', url: 'https://myanimelist.net/people/1055/Aoi_Miyazaki', imageUrl: 'https://cdn.myanimelist.net/r/23x32/images/voiceactors/2/49681.jpg?s=51c42816f4d48bb318ee45433e6fc94e' },
    ]);
  });

  it('returns an empty list when MAL reports no results', () => {
    const html = readFileSync('tests/fixtures/people/search-empty.html', 'utf8');
    expect(parsePersonSearch(html)).toEqual([]);
  });
});
