import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseForum } from '../../src/parsers/forum.parser';

const html = readFileSync('tests/fixtures/forum/anime-forum-valid.html', 'utf8');

describe('forum parser', () => {
  it('extracts forum threads', () => {
    const threads = parseForum(html);
    expect(threads).toEqual([
      {
        topicId: 101271,
        title: 'Cowboy Bebop Episode 8 Discussion',
        startedBy: 'KillthisAccount',
        startedDate: 'Jul 23, 2009',
        replies: 159,
        lastPostBy: 'TheGhoster_12',
      },
    ]);
  });

  // Real pages (2026-11-05): anime 38099 and manga 175006, which have no topics. 502 before.
  describe('a title with no topics', () => {
    const anime = readFileSync('tests/fixtures/forum/anime-no-topics-real.html', 'utf8');
    const manga = readFileSync('tests/fixtures/forum/manga-no-topics-real.html', 'utf8');

    it('is an empty list on anime and manga', () => {
      expect(parseForum(anime)).toEqual([]);
      expect(parseForum(manga)).toEqual([]);
    });

    it('is still an error without the notice', () => {
      expect(() => parseForum(anime.replace('No discussion topic was found.', ''))).toThrow('empty_forum_page');
    });

    it('is still an error when topic rows are there but none parse', () => {
      const broken = `${html.replaceAll('topicid=', 'thread=')}${anime}`;
      expect(() => parseForum(broken)).toThrow('empty_forum_page');
    });
  });
});
