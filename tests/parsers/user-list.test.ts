import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserAnimeList } from '../../src/parsers/user-anime-list.parser';
import { parseUserMangaList } from '../../src/parsers/user-manga-list.parser';
import { listLayout, parseUserMediaListSnapshot } from '../../src/parsers/user-list.parser';

const modernAnime = readFileSync('tests/fixtures/users/anime-list-modern.html', 'utf8');
const modernManga = readFileSync('tests/fixtures/users/manga-list-modern.html', 'utf8');
const classicAnime = readFileSync('tests/fixtures/users/anime-list.html', 'utf8');
const classicManga = readFileSync('tests/fixtures/users/manga-list.html', 'utf8');

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
      malId: 21,
      title: 'One Piece',
      status: 'watching',
      score: 9,
      progress: 623,
      total: null,
      startedAt: '2003-09-21',
      updatedAt: '2021-04-19T21:44:42.000Z',
    });
    expect(entries[1]).toMatchObject({
      malId: 48,
      title: '.hack//Sign',
      status: 'completed',
      total: 26,
      updatedAt: '2007-03-07T17:49:39.000Z',
    });
    expect(entries[0]?.imageUrl).toContain('cdn.myanimelist.net');
  });

  it('uses the reading vocabulary for manga and drops MAL zero-as-unset', () => {
    const entries = parseUserMangaList(modernManga, 'Xinil', '2026-07-30T00:00:00.000Z');
    expect(entries[0]).toMatchObject({
      malId: 14090,
      title: 'All Rounder Meguru',
      status: 'reading',
      score: 8,
      progress: 28,
      total: 178,
      startedAt: '2010-06-01',
    });
    expect(entries[2]).toMatchObject({ malId: 1096, startedAt: null, finishedAt: null });
  });

  // The payload must be read straight off the attribute. Routing it through the shared `decodeHtml` helper
  // would drop anything shaped like a tag, collapse double spaces and decode `&amp;` ahead of `&quot;` —
  // each one corrupting a title without raising anything.
  it('keeps titles with angle brackets, ampersands and repeated spaces intact', () => {
    const items = [
      {
        status: 2,
        score: 8,
        num_watched_episodes: 12,
        anime_num_episodes: 12,
        anime_id: 9253,
        anime_title: 'Fate&amp;Stay &lt;Night&gt;  Extra',
        anime_image_path: 'https://cdn.myanimelist.net/images/anime/5/73199.jpg',
        start_date_string: '04-06-11',
        finish_date_string: '',
        updated_at: 0,
      },
    ];
    const attribute = JSON.stringify(items).replace(/"/g, '&quot;');
    const html = `<!doctype html><html><body><table data-items="${attribute}"></table></body></html>`;
    const entries = parseUserAnimeList(html, 'tester', '2026-07-30T00:00:00.000Z');
    expect(entries[0]?.title).toBe('Fate&Stay <Night>  Extra');
  });

  // MAL leaves a numeric-looking title unquoted, so it arrives as a JSON number. Reading only strings emptied
  // those rows, and a single empty title failed the schema and rejected the whole page — one entry like
  // "86 Eighty-Six" was enough to 502 an entire list.
  it('accepts a title MAL encoded as a number', () => {
    const items = [
      {
        status: 2,
        score: 9,
        num_watched_episodes: 11,
        anime_num_episodes: 11,
        anime_id: 41457,
        anime_title: 86,
        anime_image_path: 'https://cdn.myanimelist.net/images/anime/1987/117507.jpg',
        start_date_string: null,
        finish_date_string: null,
        updated_at: 0,
      },
      {
        status: 2,
        score: 1,
        num_watched_episodes: 1,
        anime_num_episodes: 1,
        anime_id: 29978,
        anime_title: 1,
        anime_image_path: 'https://cdn.myanimelist.net/images/anime/12/81163.jpg',
        start_date_string: null,
        finish_date_string: null,
        updated_at: 0,
      },
    ];
    const html = `<!doctype html><html><body><table data-items="${JSON.stringify(items).replace(/"/g, '&quot;')}"></table></body></html>`;
    const result = parseUserMediaListSnapshot(html, 'tester', 'anime', '2026-07-30T00:00:00.000Z');
    expect(result.kind).toBe('complete');
    expect(result.kind === 'complete' && result.items.map((entry) => entry.title)).toEqual(['86', '1']);
  });

  // `anime_num_episodes: 0` on One Piece means "still airing, count unknown", not zero episodes.
  it('never reports a zero count as a real value', () => {
    const entries = parseUserAnimeList(modernAnime, 'Xinil', '2026-07-30T00:00:00.000Z');
    expect(entries.every((entry) => entry.total === null || entry.total > 0)).toBe(true);
    expect(entries.every((entry) => entry.score === null || entry.score > 0)).toBe(true);
  });
});

// The fixtures below are real rows lifted from Amayacrab's own list pages, one per status group, keeping
// MAL's markup byte for byte. The hand-written stubs they replaced carried no progress cell at all, which
// is why a parser that read the row-number cell as the progress passed the suite for as long as it did.
describe('classic list layout', () => {
  const classicAnimeEntries = parseUserAnimeList(classicAnime, 'amayacrab', '2026-07-19T00:00:00.000Z');
  const classicMangaEntries = parseUserMangaList(classicManga, 'amayacrab', '2026-07-19T00:00:00.000Z');

  it('parses anime list rows without fetching', () => {
    expect(classicAnimeEntries).toHaveLength(7);
    expect(classicAnimeEntries[0]).toMatchObject({ malId: 918, title: 'Gintama', score: null });
  });

  it('parses manga list rows without fetching', () => {
    expect(classicMangaEntries).toHaveLength(3);
    expect(classicMangaEntries[1]).toMatchObject({ malId: 132247, score: 5 });
  });

  // Every row opens with a per-group row counter that reads `1`. A window reaching back before the title
  // anchor picked that up instead of the real cell: Accel World came out as 1 episode watched, not 16.
  it('reads the progress cell, not the row number', () => {
    // The fixture keeps that counter cell, so this only passes if the window stays inside the right column.
    expect(classicAnime).toContain('<td align="center" width="30" class="td1" style="border-left-width: 1px;">');
    expect(classicAnimeEntries.find((entry) => entry.malId === 11759)).toMatchObject({ progress: 16, total: 24 });
  });

  it('keeps a row from reading its neighbour: every entry gets its own numbers', () => {
    expect(classicAnimeEntries.map((entry) => [entry.malId, entry.progress, entry.total])).toEqual([
      [918, 101, 201], // Watching   — 101/201
      [12291, 12, 12], // Completed  — bare `12`, and the anime has 12 episodes
      [25015, 1, 1], // Completed  — a movie
      [20787, 3, 13], // On-Hold    — 3/13
      [11759, 16, 24], // Dropped    — 16/24
      [57892, 7, 12], // Dropped    — 7/12
      [34636, null, 24], // Plan to Watch — `-/24`, nothing watched yet
    ]);
  });

  // MAL collapses the cell to one number only when the entry is complete, so that number is both sides.
  it('treats the collapsed cell as watched-equals-total, and `-` as unknown', () => {
    expect(classicMangaEntries.find((entry) => entry.malId === 132247)).toMatchObject({ progress: 268, total: 268 });
    expect(classicMangaEntries.find((entry) => entry.malId === 166182)).toMatchObject({ progress: 18, total: null });
  });

  // The classic path used to decode `&amp;` and nothing else, so quotes and apostrophes reached the API raw.
  it('decodes entities in the title like the modern layout already did', () => {
    expect(classicMangaEntries.find((entry) => entry.malId === 166182)?.title).toBe(
      '"Ano Toki Tasukete Itadaita Monster Musume desu.": Isekai Ossan Kyoushi Totsuzen no Moteki ni Konwaku suru',
    );
    expect(classicMangaEntries.find((entry) => entry.malId === 132247)?.title).toBe(
      "A Returner's Magic Should Be Special",
    );
    expect(classicAnimeEntries.find((entry) => entry.malId === 57892)?.title).toBe(
      'Hazurewaku no "Joutai Ijou Skill" de Saikyou ni Natta Ore ga Subete wo Juurin suru made',
    );
  });

  // An unscored entry renders `score-na`, not a number — it must not inherit the score of the row above.
  it('leaves an unscored entry null instead of borrowing a score', () => {
    expect(classicAnimeEntries.find((entry) => entry.malId === 918)?.score).toBeNull();
    expect(classicMangaEntries.find((entry) => entry.malId === 166182)?.score).toBeNull();
  });
});
