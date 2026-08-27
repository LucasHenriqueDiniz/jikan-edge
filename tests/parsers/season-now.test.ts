import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSeasonNow, parseSeasonNowSnapshot } from '../../src/parsers/season-now.parser';

const html = readFileSync('tests/fixtures/anime/season-now-valid.html', 'utf8');
// Byte-exact cards from the live season and upcoming pages, assembled into one document. The
// hand-written fixture above cannot carry this test: it has no `js-anime-type-all`, no `kids`/`r18`
// class prefixes and no section headings, so a parser that read the heading — or that matched the
// class too strictly — would pass against it and fail in production.
const realHtml = readFileSync('tests/fixtures/anime/season-now-real.html', 'utf8');

describe('season now parser', () => {
  it('extracts every card from the single-document season page', () => {
    const entries = parseSeasonNow(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ malId: 59193, title: 'Mushoku Tensei III: Isekai Ittara Honki Dasu', score: 8.78, members: 280213, startDate: '20260706' });
  });
  it('flags a snapshot missing the terminal marker as partial', () => {
    const result = parseSeasonNowSnapshot(html.replace('</html>', ''));
    expect(result.kind).toBe('partial');
  });
});

// `type` was hardcoded null, so all 887 entries across seasons/now, seasons/upcoming and
// seasons/:year/:season promised a field they could never fill.
describe('media type on seasonal cards', () => {
  const byId = new Map(parseSeasonNow(realHtml).map((entry) => [entry.malId, entry]));

  it('reads each of MyAnimeList\'s type ids', () => {
    expect(byId.get(59193)?.type).toBe('TV');
    expect(byId.get(64779)?.type).toBe('OVA');
    expect(byId.get(48820)?.type).toBe('Movie');
    expect(byId.get(64802)?.type).toBe('Special');
    expect(byId.get(61607)?.type).toBe('ONA');
  });

  // Both cards are filed under headings that name a different type than the card does: 62233 is a
  // TV Special sitting under "TV (New)", and 63143 is Unknown sitting under "Special". Reading the
  // heading instead of the card would give the wrong answer for both, and the schedule page — which
  // files the same cards under weekday headings — would be wrong for every entry.
  it('takes the type from the card, not from the heading above it', () => {
    expect(byId.get(62233)?.type).toBe('TV Special');
    expect(byId.get(63143)?.type).toBe('Unknown');
  });

  // `kids` and `r18` cards carry extra classes before the type, and there is one of each here.
  it('is not thrown off by the extra classes on kids and r18 cards', () => {
    expect(byId.get(63641)?.type).toBe('TV');
    expect(byId.get(63468)?.type).toBe('TV');
  });

  it('leaves an unrecognised id null rather than inventing a label', () => {
    const invented = parseSeasonNow(realHtml.replace('js-anime-type-all js-anime-type-3', 'js-anime-type-all js-anime-type-77'));
    expect(invented.find((entry) => entry.malId === 48820)?.type).toBeNull();
  });
});
