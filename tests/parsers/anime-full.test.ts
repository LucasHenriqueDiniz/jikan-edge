import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeFull } from '../../src/parsers/anime-full.parser';

const html = readFileSync('tests/fixtures/anime/full-valid.html', 'utf8');

describe('anime full parser', () => {
  it('extracts base detail fields plus opening/ending theme songs', () => {
    const full = parseAnimeFull(html, 1, '2026-07-26T00:00:00.000Z');
    expect(full.malId).toBe(1);
    expect(full.title).toBe('Cowboy Bebop');
    expect(full.themeSongs.openings).toEqual([
      { title: 'Tank!', artist: 'The Seatbelts', episodes: 'eps 1-25' },
      // MAL's newer widget (confirmed live on Frieren, mixed in on Fullmetal Alchemist: Brotherhood)
      // drops the theme-song-title span entirely: a quoted plain-text title follows the index span
      // directly instead.
      { title: 'Rain', artist: 'Some Artist', episodes: 'eps 26' },
    ]);
    expect(full.themeSongs.endings).toEqual([
      { title: 'The Real Folk Blues', artist: 'The Seatbelts feat. Mai Yamane', episodes: 'eps 1-12, 14-25' },
      { title: 'Space Lion', artist: 'The Seatbelts', episodes: 'eps 13' },
    ]);
  });
});
