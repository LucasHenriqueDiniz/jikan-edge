import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClubList } from '../../src/parsers/club-list.parser';

const html = readFileSync('tests/fixtures/clubs/index-valid.html', 'utf8');

describe('club list parser', () => {
  it('extracts club entries', () => {
    const clubs = parseClubList(html);
    expect(clubs).toEqual([
      {
        malId: 94046,
        title: 'chud club',
        imageUrl: 'https://cdn.myanimelist.net/images/clubs/18/374551.jpg',
        description: 'club for chuds',
        members: 25,
      },
      {
        malId: 39921,
        title: "Namine's Club",
        imageUrl: 'https://cdn.myanimelist.net/images/clubs/16/371139.jpg',
        description: 'A cafe for fans',
        members: 12,
      },
    ]);
  });
});
