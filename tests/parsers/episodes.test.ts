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

  // The past-end page carries MAL's "no episode information" notice too, and the notice is what makes
  // an empty first page legitimate — see the next block.
  it('is an empty list on a first page too, where it carries the notice', () => {
    expect(parseEpisodes(pastEnd)).toEqual([]);
  });
});

// `/anime/38099/x/episode` (Pakkororin): a TV show listed as `(0/1,512)` — 1,512 episodes and none
// added to MAL. Page 1, the heading, the notice, no rows. It answered 502 until 2026-11-05.
describe('a title with no episode information', () => {
  const noEpisodes = readFileSync('tests/fixtures/episodes/no-episode-info-real.html', 'utf8');

  it('is an empty list on page 1', () => {
    expect(parseEpisodes(noEpisodes)).toEqual([]);
  });

  // Without the notice, an empty first page is still a broken document.
  it('is still an error on page 1 once the notice is gone', () => {
    const withoutNotice = noEpisodes.replace('No episode information has been added to this title.', '');
    expect(() => parseEpisodes(withoutNotice)).toThrow('empty_episodes_page');
  });
});

// A page past the first that has rows and parses none of them is a markup change, not the end of the
// list. Answering it with [] would hide the change behind a 200 on every page but the first.
describe('a page whose rows no longer parse', () => {
  const changed = readFileSync('tests/fixtures/episodes/one-piece-filler-real.html', 'utf8').replaceAll(
    'class="episode-title',
    'class="episode-name',
  );

  it('is still an error past page 1', () => {
    expect(() => parseEpisodes(changed, true)).toThrow('empty_episodes_page');
  });
});
