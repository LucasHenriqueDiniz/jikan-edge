import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTopManga } from '../../src/parsers/top-manga.parser';

const html = readFileSync('tests/fixtures/manga/top-manga-page1.html', 'utf8');

describe('top manga parser', () => {
  it('extracts ranked entries from a MAL-paginated page', () => {
    const entries = parseTopManga(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      malId: 2,
      title: 'Berserk',
      score: 9.46,
      type: 'Manga',
      volumes: null,
      members: 804_370,
    });
    expect(entries[1]).toMatchObject({ malId: 656, title: 'Vagabond', score: 9.24, volumes: 37 });
  });
});
