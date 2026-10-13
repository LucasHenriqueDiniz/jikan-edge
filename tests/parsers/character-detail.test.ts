import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterDetail } from '../../src/parsers/character-detail.parser';

const html = readFileSync('tests/fixtures/characters/detail-valid.html', 'utf8');

describe('character detail parser', () => {
  it('normalizes a public character detail page', () => {
    const detail = parseCharacterDetail(html, 1, '2026-07-26T00:00:00.000Z');
    expect(detail.name).toBe('Spike Spiegel');
    expect(detail.nameKanji).toBe('スパイク・スピーゲル');
    expect(detail.url).toBe('https://myanimelist.net/character/1/Spike_Spiegel');
    expect(detail.imageUrl).toContain('cdn.myanimelist.net');
    // A character has no `l` variant on the CDN — deriving one would publish a 404.
    expect(detail.images.small).toBe(detail.imageUrl?.replace(/\.jpg$/, 't.jpg'));
    expect(detail.images.medium).toBe(detail.imageUrl);
    expect(detail.images.large).toBeNull();
    expect(detail.favorites).toBe(49_189);
    expect(detail.about).toContain('Spike Spiegel is a tall and lean bounty hunter');
  });

  // extractAbout used to cut off at a fixed 4,000 characters past </h2> when "About" was the last
  // normal_header section on the page (a character with no voice actors or anime/manga appearances
  // listed after it) — the same fixed-budget mistake already fixed in parseStaff/backgroundSection.
  it('does not truncate a long About section that is the last one on the page', () => {
    const longAbout = 'Lore. '.repeat(1000); // ~6,000 chars, past the old 4,000-char cap
    const page = `<html><body>
      <h1 class="title-name"><strong>Test Character</strong></h1>
      <h2 class="normal_header" style="height: 15px;">Test Character</h2>${longAbout}
      </body></html>`;
    const detail = parseCharacterDetail(page, 1, '2026-08-10T00:00:00.000Z');
    expect(detail.about?.length).toBeGreaterThan(4_000);
    expect(detail.about).toContain(longAbout.trim().slice(-20));
  });
});

// A contiguous prefix of Luffy's real page (fetched through Cloudflare's network, 2026-10-11), cut
// at the end of the About section. Its About block starts at byte 112,535 — the parser used to read
// only the first 60,000 bytes, and production served this character with kanji, favourites and
// About all null. Five of the six characters measured that day had the same layout.
describe('character detail on a long page', () => {
  const luffy = readFileSync('tests/fixtures/characters/detail-luffy-real.html', 'utf8');

  it('reads the fields that sit past the old 60 KB window', () => {
    expect(luffy.indexOf('Member Favorites:')).toBeGreaterThan(60_000);
    const detail = parseCharacterDetail(luffy, 40, '2026-10-11T00:00:00.000Z');
    expect(detail.nameKanji).toBe('モンキー・D・ルフィ');
    expect(detail.favorites).toBe(150_082);
    expect(detail.about?.length).toBeGreaterThan(1_000);
  });

  // The heading is `Luffy "Mugiwara, Straw Hat" Monkey D.`; MAL's own og:title is the name alone.
  it('takes the nicknames out of the name', () => {
    const detail = parseCharacterDetail(luffy, 40, '2026-10-11T00:00:00.000Z');
    expect(detail.name).toBe('Luffy Monkey D.');
    expect(luffy).toContain('<meta property="og:title" content="Luffy Monkey D.">');
    expect(detail.nicknames).toEqual(['Mugiwara', 'Straw Hat']);
  });

  it('leaves a name without nicknames alone', () => {
    const detail = parseCharacterDetail(html, 1, '2026-07-26T00:00:00.000Z');
    expect(detail.name).toBe('Spike Spiegel');
    expect(detail.nicknames).toEqual([]);
  });
});
