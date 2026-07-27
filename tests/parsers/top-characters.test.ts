import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTopCharacters } from '../../src/parsers/top-characters.parser';

const html = readFileSync('tests/fixtures/characters/top-characters-page1.html', 'utf8');

describe('top characters parser', () => {
  it('extracts ranked character entries with animeography/mangaography', () => {
    const entries = parseTopCharacters(html);
    expect(entries).toEqual([
      {
        malId: 417, name: 'Lamperouge, Lelouch', nameKanji: 'ルルーシュ・ランペルージ',
        imageUrl: 'https://cdn.myanimelist.net/r/50x78/images/characters/8/406163.jpg?s=60d19d262b921f183f192791dd4e4183',
        animeography: [
          { malId: 1575, title: 'Code Geass: Hangyaku no Lelouch' },
          { malId: 1953, title: 'Code Geass: Hangyaku no Lelouch Picture Drama' },
        ],
        mangaography: [{ malId: 1528, title: 'Code Geass: Hangyaku no Lelouch' }],
        favorites: 180332,
      },
      {
        malId: 40, name: 'Monkey D., Luffy', nameKanji: 'モンキー・D・ルフィ',
        imageUrl: 'https://cdn.myanimelist.net/r/50x78/images/characters/9/310307.jpg?s=1422edf1e44c7b6262386330461eecfd',
        animeography: [{ malId: 21, title: 'One Piece' }],
        mangaography: [{ malId: 13, title: 'One Piece' }],
        favorites: 165210,
      },
    ]);
  });
});
