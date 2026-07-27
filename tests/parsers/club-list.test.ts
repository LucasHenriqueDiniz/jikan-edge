import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClubList } from '../../src/parsers/club-list.parser';

const html = readFileSync('tests/fixtures/clubs/index-valid.html', 'utf8');

describe('club list parser', () => {
  it('extracts club entries', () => {
    const clubs = parseClubList(html);
    expect(clubs).toEqual([
      { malId: 94046, title: 'chud club', imageUrl: 'https://cdn.myanimelist.net/r/50x70/images/clubs/18/374551.jpg?s=0aa6d8063f8e6d8eece0da3012284470', description: 'club for chuds', members: 25 },
      { malId: 39921, title: "Namine's Club", imageUrl: 'https://cdn.myanimelist.net/r/50x70/images/clubs/16/371139.jpg?s=c93146c930db4517b05700ec4494db54', description: 'A cafe for fans', members: 12 },
    ]);
  });
});
