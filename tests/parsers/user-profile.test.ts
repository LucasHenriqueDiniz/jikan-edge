import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserProfile, parseUserStatistics } from '../../src/parsers/user-profile.parser';

const html = readFileSync('tests/fixtures/users/profile-valid.html', 'utf8');
const statsHtml = readFileSync('tests/fixtures/users/profile-stats-real.html', 'utf8');

describe('user profile parser', () => {
  it('normalizes a public profile', () => {
    const profile = parseUserProfile(html, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(profile.canonicalUsername).toBe('Amayacrab');
    expect(profile.avatarUrl).toContain('cdn.myanimelist.net');
  });

  it('returns predictable statistics', () => {
    const statistics = parseUserStatistics(html);
    expect(statistics.anime.completed).toBe(273);
    expect(statistics.manga.planToRead).toBe(22);
  });
});

describe('user statistics parser', () => {
  it('reads every anime field from the profile markup', () => {
    expect(parseUserStatistics(statsHtml).anime).toEqual({
      watching: 1,
      completed: 233,
      onHold: 8,
      dropped: 93,
      planToWatch: 64,
      totalEntries: 399,
      rewatched: 60,
      episodesWatched: 8481,
      daysWatched: 142.3,
      meanScore: 7.37,
    });
  });

  it('reads every manga field from the profile markup', () => {
    expect(parseUserStatistics(statsHtml).manga).toEqual({
      reading: 15,
      completed: 12,
      onHold: 3,
      dropped: 21,
      planToRead: 25,
      totalEntries: 76,
      reread: 0,
      chaptersRead: 3283,
      volumesRead: 189,
      daysRead: 17.6,
      meanScore: 7.35,
    });
  });

  it('ignores the status graph bar widths that sit next to each label', () => {
    // <span class="graph anime completed" style="width: 221.9px"> precedes the real count of 233.
    expect(statsHtml).toContain('graph anime completed" style="width: 221.9px"');
    expect(parseUserStatistics(statsHtml).anime.completed).not.toBe(221);
  });

  it('ignores the lh10 utility class on the row that carries the count', () => {
    // <a ... class="di-ib fl-l lh10 circle anime on_hold">On-Hold</a> would otherwise report 10.
    expect(statsHtml).toContain('lh10 circle anime on_hold');
    expect(parseUserStatistics(statsHtml).anime.onHold).toBe(8);
  });

  it('keeps each media type inside its own section', () => {
    const stats = parseUserStatistics(statsHtml);
    expect(stats.anime.totalEntries).not.toBe(stats.manga.totalEntries);
    expect(stats.anime.daysWatched).not.toBe(stats.manga.daysRead);
  });

  it('reports nulls instead of zeros when the stats markup is absent', () => {
    const stats = parseUserStatistics('<html><body>no stats here</body></html>');
    expect(stats.anime).toMatchObject({ rewatched: null, episodesWatched: null, daysWatched: null, meanScore: null });
    expect(stats.manga).toMatchObject({ reread: null, chaptersRead: null, volumesRead: null, daysRead: null, meanScore: null });
  });
});
