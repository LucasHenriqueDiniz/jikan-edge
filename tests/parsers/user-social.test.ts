import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserFriends } from '../../src/parsers/user-friends.parser';
import { parseUserClubs } from '../../src/parsers/user-clubs.parser';

const friendsHtml = readFileSync('tests/fixtures/users/friends-valid.html', 'utf8');
const clubsHtml = readFileSync('tests/fixtures/users/clubs-valid.html', 'utf8');

describe('user friends parser', () => {
  it('extracts friends with last-online and friends-since', () => {
    const friends = parseUserFriends(friendsHtml);
    expect(friends).toHaveLength(2);
    expect(friends[0]).toEqual({
      username: 'Quinfi',
      imageUrl: 'https://cdn.myanimelist.net/s/common/userimages/b3de0efb.jpg',
      lastOnline: '1 minute ago',
      friendsSince: 'Dec 23, 2016 10:34 PM',
    });
    expect(friends[1].username).toBe('Falques');
  });

  it('returns an empty list for a page without friends', () => {
    expect(parseUserFriends('<html><body>no friends section</body></html>')).toEqual([]);
  });
});

describe('user clubs parser', () => {
  it('extracts clubs with ids and urls', () => {
    const clubs = parseUserClubs(clubsHtml);
    expect(clubs).toEqual([
      { malId: 77364, name: 'Buff Anime Girls', url: 'https://myanimelist.net/clubs.php?cid=77364' },
      { malId: 1, name: 'Cowboy Bebop', url: 'https://myanimelist.net/clubs.php?cid=1' },
    ]);
  });

  it('returns an empty list for a page without clubs', () => {
    expect(parseUserClubs('<html><body>no clubs</body></html>')).toEqual([]);
  });
});
