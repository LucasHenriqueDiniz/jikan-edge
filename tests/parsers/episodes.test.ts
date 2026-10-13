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
        filler: false,
        recap: false,
      },
    ]);
  });
});

// Episodes 48-52 of One Piece, a contiguous excerpt of the real list (2026-10-11). 50 and 51 are
// Filler: MAL puts a `<span>` with the marker before the title link, and the parser used to require
// the link to open the cell, so both rows vanished — 11 of the first page's 100.
describe('filler and recap rows', () => {
  const rows = readFileSync('tests/fixtures/episodes/one-piece-filler-real.html', 'utf8');

  it('keeps Filler rows and flags them', () => {
    const episodes = parseEpisodes(rows);
    expect(episodes.map((episode) => episode.number)).toEqual([48, 49, 50, 51, 52]);
    expect(episodes.filter((episode) => episode.filler).map((episode) => episode.number)).toEqual([50, 51]);
    expect(episodes.find((episode) => episode.number === 50)?.title).toBe(
      'Usopp vs. Daddy the Parent! Showdown at High!',
    );
    expect(episodes.every((episode) => !episode.recap)).toBe(true);
  });
});

// `?offset=99900` on One Piece: the heading and the "no episode information" notice, no rows.
describe('a page past the last episode', () => {
  const pastEnd = readFileSync('tests/fixtures/episodes/one-piece-past-end-real.html', 'utf8');

  it('is an empty list where the caller allows it', () => {
    expect(parseEpisodes(pastEnd, true)).toEqual([]);
  });

  it('is still an error on a first page, where an empty list means a broken document', () => {
    expect(() => parseEpisodes(pastEnd)).toThrow('empty_episodes_page');
  });
});
