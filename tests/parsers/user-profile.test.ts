import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserProfile, parseUserStatistics } from '../../src/parsers/user-profile.parser';

const html = readFileSync('tests/fixtures/users/profile-valid.html', 'utf8');
describe('user profile parser', () => {
  it('normalizes a public profile', () => {
    const profile = parseUserProfile(html, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(profile.canonicalUsername).toBe('Amayacrab');
    expect(profile.avatarUrl).toContain('cdn.myanimelist.net');
  });
  it('returns predictable statistics', () => {
    const statistics = parseUserStatistics(html);
    expect(statistics.anime.completed).toBe(10);
    expect(statistics.manga.planToRead).toBe(2);
  });
});
