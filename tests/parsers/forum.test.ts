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
});
