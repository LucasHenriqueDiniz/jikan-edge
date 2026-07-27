import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserAnimeList } from '../../src/parsers/user-anime-list.parser';
import { parseUserMangaList } from '../../src/parsers/user-manga-list.parser';

describe('user list parsers', () => {
  it('parses anime list rows without fetching', () => {
    const entries = parseUserAnimeList(readFileSync('tests/fixtures/users/anime-list.html', 'utf8'), 'amayacrab', '2026-07-19T00:00:00.000Z');
    expect(entries).toHaveLength(2); expect(entries[0]).toMatchObject({ malId: 1, title: 'Cowboy Bebop', score: 9 });
  });
  it('parses manga list rows without fetching', () => {
    const entries = parseUserMangaList(readFileSync('tests/fixtures/users/manga-list.html', 'utf8'), 'amayacrab', '2026-07-19T00:00:00.000Z');
    expect(entries).toHaveLength(1); expect(entries[0]).toMatchObject({ malId: 2, title: 'Berserk', score: 10 });
  });
});
