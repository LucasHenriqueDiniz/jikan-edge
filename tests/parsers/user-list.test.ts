import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserAnimeList } from '../../src/parsers/user-anime-list.parser';
import { parseUserMangaList } from '../../src/parsers/user-manga-list.parser';
import { listLayout, parseUserMediaListSnapshot } from '../../src/parsers/user-list.parser';

const modernAnime = readFileSync('tests/fixtures/users/anime-list-modern.html', 'utf8');
const modernManga = readFileSync('tests/fixtures/users/manga-list-modern.html', 'utf8');
const classicAnime = readFileSync('tests/fixtures/users/anime-list.html', 'utf8');

// MAL renders the list in whichever layout the user picked. Only the classic table used to be read, so every
// modern-layout account matched zero rows and the completeness guard turned that into a 502.
describe('modern list layout', () => {
  it('tells the two layouts apart', () => {
    expect(listLayout(modernAnime)).toBe('modern');
    expect(listLayout(classicAnime)).toBe('classic');
  });

  it('reads entries out of the data-items payload instead of matching zero rows', () => {
    const result = parseUserMediaListSnapshot(modernAnime, 'Xinil', 'anime', '2026-07-30T00:00:00.000Z');
    expect(result.kind).toBe('complete');
    expect(result.kind === 'complete' && result.items).toHaveLength(3);
  });

  it('maps every field the classic table never carried', () => {
    const entries = parseUserAnimeList(modernAnime, 'Xinil', '2026-07-30T00:00:00.000Z');
    expect(entries[0]).toMatchObject({
      malId: 21, title: 'One Piece', status: 'watching', score: 9, progress: 623,
      total: null, startedAt: '2003-09-21', updatedAt: '2021-04-19T21:44:42.000Z',
    });
    expect(entries[1]).toMatchObject({ malId: 48, title: '.hack//Sign', status: 'completed', total: 26, updatedAt: '2007-03-07T17:49:39.000Z' });
    expect(entries[0]?.imageUrl).toContain('cdn.myanimelist.net');
  });

  it('uses the reading vocabulary for manga and drops MAL zero-as-unset', () => {
    const entries = parseUserMangaList(modernManga, 'Xinil', '2026-07-30T00:00:00.000Z');
    expect(entries[0]).toMatchObject({ malId: 14090, title: 'All Rounder Meguru', status: 'reading', score: 8, progress: 28, total: 178, startedAt: '2010-06-01' });
    expect(entries[2]).toMatchObject({ malId: 1096, startedAt: null, finishedAt: null });
  });

  // The payload must be read straight off the attribute. Routing it through the shared `decodeHtml` helper
  // would drop anything shaped like a tag, collapse double spaces and decode `&amp;` ahead of `&quot;` —
  // each one corrupting a title without raising anything.
  it('keeps titles with angle brackets, ampersands and repeated spaces intact', () => {
    const items = [{
      status: 2, score: 8, num_watched_episodes: 12, anime_num_episodes: 12,
      anime_id: 9253, anime_title: 'Fate&amp;Stay &lt;Night&gt;  Extra', anime_image_path: 'https://cdn.myanimelist.net/images/anime/5/73199.jpg',
      start_date_string: '04-06-11', finish_date_string: '', updated_at: 0,
    }];
    const attribute = JSON.stringify(items).replace(/"/g, '&quot;');
    const html = `<!doctype html><html><body><table data-items="${attribute}"></table></body></html>`;
    const entries = parseUserAnimeList(html, 'tester', '2026-07-30T00:00:00.000Z');
    expect(entries[0]?.title).toBe('Fate&Stay <Night>  Extra');
  });

  // `anime_num_episodes: 0` on One Piece means "still airing, count unknown", not zero episodes.
  it('never reports a zero count as a real value', () => {
    const entries = parseUserAnimeList(modernAnime, 'Xinil', '2026-07-30T00:00:00.000Z');
    expect(entries.every((entry) => entry.total === null || entry.total > 0)).toBe(true);
    expect(entries.every((entry) => entry.score === null || entry.score > 0)).toBe(true);
  });
});

describe('user list parsers', () => {
  it('parses anime list rows without fetching', () => {
    const entries = parseUserAnimeList(readFileSync('tests/fixtures/users/anime-list.html', 'utf8'), 'amayacrab', '2026-07-19T00:00:00.000Z');
    expect(entries).toHaveLength(2); expect(entries[0]).toMatchObject({ malId: 1, title: 'Cowboy Bebop', score: 9 });
  });
  it('parses manga list rows without fetching', () => {
    const entries = parseUserMangaList(readFileSync('tests/fixtures/users/manga-list.html', 'utf8'), 'amayacrab', '2026-07-19T00:00:00.000Z');
    expect(entries).toHaveLength(1); expect(entries[0]).toMatchObject({ malId: 2, title: 'Berserk', score: 10 });
  });
});
