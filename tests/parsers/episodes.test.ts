import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEpisodes } from '../../src/parsers/episodes.parser';

const html = readFileSync('tests/fixtures/episodes/anime-episodes-valid.html', 'utf8');

describe('episodes parser', () => {
  it('extracts episode entries', () => {
    const episodes = parseEpisodes(html);
    expect(episodes).toEqual([
      {
        number: 1,
        title: 'Asteroid Blues',
        titleJapanese: 'アステロイド・ブルース',
        url: 'https://myanimelist.net/anime/1/Cowboy_Bebop/episode/1',
        aired: 'Oct 24, 1998',
        score: 4.32,
        forumReplies: 241,
      },
    ]);
  });
});
