import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePictures } from '../../src/parsers/pictures.parser';

const html = readFileSync('tests/fixtures/pictures/anime-pics-valid.html', 'utf8');

describe('pictures parser', () => {
  it('extracts full-size and thumbnail image pairs', () => {
    const pictures = parsePictures(html);
    expect(pictures).toEqual([
      {
        imageUrl: 'https://cdn.myanimelist.net/images/anime/7/3791l.jpg',
        thumbnailUrl: 'https://cdn.myanimelist.net/images/anime/7/3791.jpg',
      },
      {
        imageUrl: 'https://cdn.myanimelist.net/images/anime/12/19609l.jpg',
        thumbnailUrl: 'https://cdn.myanimelist.net/images/anime/12/19609.jpg',
      },
    ]);
  });
});
