import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWatchPromos } from '../../src/parsers/watch-promos.parser';

const html = readFileSync('tests/fixtures/watch/promos-valid.html', 'utf8');

describe('watch promos parser', () => {
  it('extracts recent promo/trailer entries', () => {
    const entries = parseWatchPromos(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      animeId: 64675,
      animeTitle: 'Sanguo Di Yi Bu: Zheng Luoyang',
      title: 'PV 3',
    });
    expect(entries[0].videoUrl).toContain('youtube-nocookie.com');
    expect(entries[0].imageUrl).toContain('cdn.myanimelist.net');
  });
});
