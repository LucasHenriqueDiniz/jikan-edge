import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClubMembers } from '../../src/parsers/club-members.parser';

const html = readFileSync('tests/fixtures/clubs/members-valid.html', 'utf8');

describe('club members parser', () => {
  it('extracts member entries', () => {
    const members = parseClubMembers(html);
    expect(members).toEqual([
      { username: '-alquimista-', url: 'https://myanimelist.net/profile/-alquimista-', avatarUrl: 'https://cdn.myanimelist.net/s/common/userimages/75f9becb-3d14-496f-bbef-4a00146833a7_225w' },
      { username: '-Ayu', url: 'https://myanimelist.net/profile/-Ayu', avatarUrl: 'https://cdn.myanimelist.net/images/kaomoji_mal_white.png' },
    ]);
  });
});
