import { describe, expect, it } from 'vitest';
import { daterange, entity, images, malUrl, relations, titles, trailer } from '../../src/http/jikan/primitives';

describe('jikan primitives', () => {
  it('keeps every image key present even when MAL gave us nothing', () => {
    // A Jikan client reads images.jpg.image_url without optional chaining, so the nested
    // objects must exist regardless of whether we have a URL.
    expect(images(null)).toEqual({
      jpg: { image_url: null, small_image_url: null, large_image_url: null },
      webp: { image_url: null, small_image_url: null, large_image_url: null },
    });
  });

  it('puts a thumbnail in small_image_url when the page gave us two sizes', () => {
    expect(images('https://cdn/a.jpg', 'https://cdn/t.jpg').jpg).toEqual({
      image_url: 'https://cdn/a.jpg',
      small_image_url: 'https://cdn/t.jpg',
      large_image_url: null,
    });
  });

  it('omits absent title variants instead of emitting nulls', () => {
    expect(titles({ title: 'Berserk', titleEnglish: null, titleJapanese: 'ベルセルク' })).toEqual([
      { type: 'Default', title: 'Berserk' },
      { type: 'Japanese', title: 'ベルセルク' },
    ]);
  });

  it('carries the raw aired string and refuses to invent structured dates', () => {
    expect(daterange('Apr 3, 1998 to Apr 24, 1999')).toEqual({
      from: null,
      to: null,
      prop: { from: { day: null, month: null, year: null }, to: { day: null, month: null, year: null } },
      string: 'Apr 3, 1998 to Apr 24, 1999',
    });
    expect(daterange(null).string).toBeNull();
  });

  it('derives a MAL url when the source did not give one, and keeps it when it did', () => {
    expect(entity('anime', 1, 'Cowboy Bebop').url).toBe('https://myanimelist.net/anime/1');
    expect(entity('anime', 1, 'Cowboy Bebop', 'https://myanimelist.net/anime/1/Cowboy_Bebop').url).toBe('https://myanimelist.net/anime/1/Cowboy_Bebop');
    expect(malUrl('people', 1868)).toBe('https://myanimelist.net/people/1868');
  });

  it('groups relations by label in first-seen order', () => {
    expect(
      relations([
        { relation: 'Sequel', malId: 2, type: 'anime', title: 'Second' },
        { relation: 'adaptation', malId: 3, type: 'manga', title: 'Source' },
        { relation: 'Sequel', malId: 4, type: 'anime', title: 'Third' },
      ]),
    ).toEqual([
      { relation: 'Sequel', entry: [
        { mal_id: 2, type: 'anime', name: 'Second', url: 'https://myanimelist.net/anime/2' },
        { mal_id: 4, type: 'anime', name: 'Third', url: 'https://myanimelist.net/anime/4' },
      ] },
      { relation: 'Adaptation', entry: [{ mal_id: 3, type: 'manga', name: 'Source', url: 'https://myanimelist.net/manga/3' }] },
    ]);
  });

  it('pulls the youtube id out of an embed url', () => {
    expect(trailer('https://www.youtube.com/embed/qig4KOK2R2g?enablejsapi=1')).toMatchObject({
      youtube_id: 'qig4KOK2R2g',
      url: 'https://www.youtube.com/watch?v=qig4KOK2R2g',
      embed_url: 'https://www.youtube.com/embed/qig4KOK2R2g',
    });
    expect(trailer(null).youtube_id).toBeNull();
  });
});
