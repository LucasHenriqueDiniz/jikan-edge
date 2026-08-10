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
    // A character has no `l` variant on the CDN â€” deriving one would publish a 404.
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
