import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ParserError } from '../../src/parsers/html';
import { parseNews } from '../../src/parsers/news.parser';

const fixture = (name: string) => readFileSync(`tests/fixtures/news/${name}`, 'utf8');
const html = fixture('anime-news-valid.html');

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

  // MAL's empty news page is the heading and nothing else — no notice to recognise. Real excerpts of
  // anime 124, manga 120000 and person 60000 (2026-11-18), which answered 502 every time.
  it('reads an empty news page as an empty list, on anime, manga and people', () => {
    expect(parseNews(fixture('anime-no-news-real.html'))).toEqual([]);
    expect(parseNews(fixture('manga-no-news-real.html'))).toEqual([]);
    expect(parseNews(fixture('person-no-news-real.html'))).toEqual([]);
  });

  // Manga 4632 lists thirteen items, one of them without a picture. Split on the picture block, the
  // parser merged it into the item before and returned twelve.
  it('keeps an item that has no picture, apart from the one before it', () => {
    const items = parseNews(fixture('manga-news-item-without-picture-real.html'));
    expect(items).toHaveLength(13);
    const index = items.findIndex((item) => item.malId === 23155607);
    expect(items[index]).toMatchObject({
      title: 'Oyasumi Punpun Manga To End This Winter',
      imageUrl: null,
      date: 'Jul 1, 2013 1:44 PM',
      author: 'Brand',
    });
    expect(items[index - 1].malId).not.toBe(23155607);
    expect(items[index - 1].imageUrl).not.toBeNull();
    expect(new Set(items.map((item) => item.malId)).size).toBe(13);
  });

  it('refuses a page without the news heading', () => {
    expect(() => parseNews('<html><body><h2 id="recent_news">Recent News</h2></body></html>')).toThrow(ParserError);
  });

  // A page that lists news and yields none has changed shape. Returned as empty, it would be cached
  // for the whole TTL and hide every item.
  it('refuses a page that lists news it cannot read', () => {
    const unreadable = html.replace(/<strong>[^<]*<\/strong>/g, '<strong></strong>');
    expect(() => parseNews(unreadable)).toThrow('news_items_unreadable');
  });
});
