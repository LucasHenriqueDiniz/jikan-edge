import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserProfile, parseUserStatistics } from '../../src/parsers/user-profile.parser';
import { parseUserFavorites } from '../../src/parsers/user-favorites.parser';

const html = readFileSync('tests/fixtures/users/profile-valid.html', 'utf8');
describe('user profile parser', () => {
  it('normalizes a public profile', () => {
    const profile = parseUserProfile(html, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(profile.canonicalUsername).toBe('Amayacrab');
    expect(profile.avatarUrl).toContain('cdn.myanimelist.net');
  });
  it('reads status counts from the list anchors, not graph widths', () => {
    const statistics = parseUserStatistics(html);
    expect(statistics.anime).toMatchObject({ watching: 2, completed: 10, onHold: 1, dropped: 0, planToWatch: 3, totalEntries: 16 });
    expect(statistics.manga).toMatchObject({ reading: 1, completed: 4, onHold: 0, dropped: 0, planToRead: 2, totalEntries: 7 });
  });
  it('extracts episode/chapter/volume totals and mean scores', () => {
    const statistics = parseUserStatistics(html);
    expect(statistics.anime.episodesWatched).toBe(1234);
    expect(statistics.anime.meanScore).toBe(8.25);
    expect(statistics.manga.chaptersRead).toBe(356);
    expect(statistics.manga.volumesRead).toBe(41);
    expect(statistics.manga.meanScore).toBe(8);
  });
});

describe('user favorites parser', () => {
  it('emits camelCase ids with type and start year for media favorites', () => {
    const favorites = parseUserFavorites(html);
    expect(favorites.anime[0]).toMatchObject({ malId: 1, title: 'Cowboy Bebop', type: 'TV', startYear: 1998 });
    expect(favorites.manga[0]).toMatchObject({ malId: 2, title: 'Berserk', type: 'Manga', startYear: 1989 });
    expect(favorites.anime[0]?.imageUrl).toContain('cdn.myanimelist.net');
  });
  it('omits type/startYear for characters', () => {
    const favorites = parseUserFavorites(html);
    expect(favorites.characters[0]).toMatchObject({ malId: 1, name: 'Spiegel, Spike' });
    expect(favorites.characters[0]).not.toHaveProperty('startYear');
    expect(favorites.characters[0]).not.toHaveProperty('type');
  });
});
