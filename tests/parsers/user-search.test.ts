import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserSearch } from '../../src/parsers/user-search.parser';

describe('user search parser', () => {
  it('extracts a results list page', () => {
    const html = readFileSync('tests/fixtures/users/search-list-valid.html', 'utf8');
    const results = parseUserSearch(html, 'amaya');
    expect(results).toEqual([
      { username: 'AmayaCiara', url: 'https://myanimelist.net/profile/AmayaCiara', avatarUrl: 'https://cdn.myanimelist.net/images/kaomoji_mal_white.png', joinedAt: 'Jan 27, 2013 11:30 AM' },
      { username: 'AmayaProject', url: 'https://myanimelist.net/profile/AmayaProject', avatarUrl: 'https://cdn.myanimelist.net/s/common/userimages/51db26ac-2d72-4ada-a9a2-ff0580d6bb48_225w?s=ca7ea75ebb2ee51df6a44c7570d87652', joinedAt: 'Dec 26, 2017 8:04 PM' },
    ]);
  });

  it('falls back to a single-result list when MAL redirects an exact match to the profile page', () => {
    const html = readFileSync('tests/fixtures/users/profile-valid.html', 'utf8');
    const results = parseUserSearch(html, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('Amayacrab');
    expect(results[0].url).toBe('https://myanimelist.net/profile/Amayacrab');
  });
});
