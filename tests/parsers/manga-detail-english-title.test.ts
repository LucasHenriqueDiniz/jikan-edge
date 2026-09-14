import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';

// Byte-real excerpt of https://myanimelist.net/manga/4632/Oyasumi_Punpun. Unlike Berserk (the
// detail-real.html fixture), a manga with a distinct English title embeds it *inside* the h1 name
// span: `<span itemprop="name">Oyasumi Punpun<br><span class="title-english">Goodnight Punpun</span>`.
// The title regex required `</span>` immediately after the name text, so `<br>` made it match
// nothing — title came back empty, the schema's `title: min(1)` rejected it, and parseMangaDetail
// threw `invalid_manga_detail`, surfacing as a raw 500 on /v1/manga/4632 and on the exact-title
// search redirect for such a title.
const englishTitleHtml = readFileSync('tests/fixtures/manga/detail-english-title.html', 'utf8');

describe('a manga whose h1 embeds a separate English title', () => {
  const detail = parseMangaDetail(englishTitleHtml, 4632, '2026-09-14T00:00:00.000Z');

  it('extracts the romaji title, stopping before the embedded English span', () => {
    expect(detail.title).toBe('Oyasumi Punpun');
  });

  it('still reads the sidebar fields the head carries', () => {
    expect(detail.type).toBe('Manga');
    expect(detail.volumes).toBe(13);
    expect(detail.chapters).toBe(147);
    expect(detail.score).toBeGreaterThan(8);
  });
});
