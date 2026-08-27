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
  // `Days` is the one stat whose value is bare text after the label span; `Rewatched`/`Reread`
  // share the `stats-data` shape but were simply never read.
  it('extracts days and rewatched/reread counts', () => {
    const statistics = parseUserStatistics(html);
    expect(statistics.anime.daysWatched).toBe(12.5);
    expect(statistics.anime.rewatched).toBe(1);
    expect(statistics.manga.daysRead).toBe(3.1);
    expect(statistics.manga.reread).toBe(0);
  });
  // Both buckets use the same labels and sit ~2 KB apart, so a fixed-size window around "Anime Stats"
  // reaches into "Manga Stats": an anime row that disappears must read as absent, never as the manga number.
  it('does not read the manga bucket when an anime row is missing', () => {
    const withoutAnimeRows = html
      .replace(/<li[^>]*><a[^>]*circle anime completed">Completed<\/a>.*?<\/li>/, '')
      .replace(/<li[^>]*><span[^>]*>Total Entries<\/span><span[^>]*>16<\/span><\/li>/, '');
    const statistics = parseUserStatistics(withoutAnimeRows);
    expect(statistics.anime.completed).toBe(0);
    expect(statistics.anime.totalEntries).toBe(0);
    expect(statistics.manga.completed).toBe(4);
    expect(statistics.manga.totalEntries).toBe(7);
  });
});

// The synthetic fixture above is 6.5 KB, so every field sits within the first few thousand bytes and
// a prefix-window bug cannot show up in it. This one is a byte-exact capture of a real profile:
// 94 KB, avatar markup at byte 30,040. Both fields below were `null` in production for every user
// while the synthetic fixture stayed green.
const realHtml = readFileSync('tests/fixtures/users/profile-real.html', 'utf8');
describe('user profile parser, against a real profile', () => {
  it('finds the avatar even though it sits past the old 30 KB prefix window', () => {
    expect(realHtml.indexOf('class="user-image')).toBeGreaterThan(30_000);
    const profile = parseUserProfile(realHtml, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(profile.avatarUrl).toContain('cdn.myanimelist.net');
    expect(profile.avatarUrl).toContain('userimages');
  });

  // The old lookup anchored on the literal "About Me", which appears nowhere on a profile, so this
  // field could only ever be null. The real container also opens with a nested <div>, which a
  // non-greedy match to the first </div> truncates to the wrapper markup with none of the text.
  it('reads the About text through its nested markup', () => {
    expect(realHtml.includes('About Me')).toBe(false);
    expect(/word-break">\s*<div/.test(realHtml)).toBe(true);
    const profile = parseUserProfile(realHtml, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    expect(profile.about).toBeTruthy();
    // Truncating at the first </div> yielded the wrapper markup and none of the prose, so assert on
    // what distinguishes the two: real text, past the nested image, with the tags gone.
    expect(profile.about?.length).toBeGreaterThan(50);
    expect(profile.about).not.toContain('<');
    expect(profile.about).not.toContain('class=');
    expect(profile.about).toContain('\n');
  });

  it('still reads the fields that already worked', () => {
    const profile = parseUserProfile(realHtml, 'AMayacrab', '2026-07-19T00:00:00.000Z');
    // MyAnimeList renders the display name as "Amayacrab" even though the URL is /profile/AMayacrab.
    expect(profile).toMatchObject({ canonicalUsername: 'Amayacrab', location: 'Brazil', joinedAt: 'May 17, 2016' });
  });

  // A profile with no picture renders a "No Picture" placeholder with no <img> at all, and one with
  // no About omits the container rather than emitting an empty one. Both must stay null instead of
  // becoming a scrape of whatever markup sits nearby.
  it('returns null rather than guessing when the profile genuinely has neither', () => {
    const noAvatar = realHtml.replace(/<div class="user-image[^>]*>[\s\S]*?<\/div>/, '<div class="user-image mb8"><div class="btn-detail-add-picture nolink"><span class="text">No Picture</span></div>');
    expect(parseUserProfile(noAvatar, 'AMayacrab', '2026-07-19T00:00:00.000Z').avatarUrl).toBeNull();
    const noAbout = realHtml.replace('class="user-profile-about', 'class="user-profile-nothing');
    expect(parseUserProfile(noAbout, 'AMayacrab', '2026-07-19T00:00:00.000Z').about).toBeNull();
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
