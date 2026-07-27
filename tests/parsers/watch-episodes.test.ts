import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWatchEpisodes } from '../../src/parsers/watch-episodes.parser';

const html = readFileSync('tests/fixtures/watch/episodes-valid.html', 'utf8');

describe('watch episodes parser', () => {
  it('extracts recent episode entries', () => {
    const entries = parseWatchEpisodes(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ animeId: 50855, animeTitle: 'Yamato yo, Towa ni: Rebel 3199' });
    expect(entries[0].episodes).toEqual(['Episode 22', 'Episode 21']);
    expect(entries[0].imageUrl).toContain('cdn.myanimelist.net');
  });
});
