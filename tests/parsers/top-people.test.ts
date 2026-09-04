import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTopPeople } from '../../src/parsers/top-people.parser';

const html = readFileSync('tests/fixtures/people/top-people-page1.html', 'utf8');

describe('top people parser', () => {
  it('extracts ranked person entries', () => {
    const entries = parseTopPeople(html);
    expect(entries).toEqual([
      {
        malId: 118,
        name: 'Kamiya, Hiroshi',
        nameKanji: '神谷 浩史',
        imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/1/66163.jpg',
        birthday: 'Jan 28, 1975',
        favorites: 108566,
      },
      {
        malId: 185,
        name: 'Hanazawa, Kana',
        nameKanji: '花澤 香菜',
        imageUrl: 'https://cdn.myanimelist.net/images/voiceactors/3/69318.jpg',
        birthday: 'Feb 25, 1989',
        favorites: 95432,
      },
    ]);
  });
});
