import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseNews } from '../../src/parsers/news.parser';

const html = readFileSync('tests/fixtures/news/anime-news-valid.html', 'utf8');

describe('news parser', () => {
  it('extracts news items', () => {
    const items = parseNews(html);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      malId: 69976885,
      title: 'North American Anime & Manga Releases for October',
      url: 'https://myanimelist.net/news/69976885',
      date: 'Oct 10, 2023 6:34 AM',
      author: 'Aiimee',
    });
    expect(items[0].excerpt).toContain('North American anime releases for October');
  });
});
