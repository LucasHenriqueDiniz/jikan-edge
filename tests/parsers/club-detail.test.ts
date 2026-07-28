import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClubDetail } from '../../src/parsers/club-detail.parser';

const html = readFileSync('tests/fixtures/clubs/detail-valid.html', 'utf8');

describe('club detail parser', () => {
  it('normalizes a public club detail page', () => {
    const detail = parseClubDetail(html, 1, '2026-07-26T00:00:00.000Z');
    expect(detail.title).toBe('Cowboy Bebop');
    expect(detail.members).toBe(1400);
    expect(detail.pictures).toBe(25);
    expect(detail.category).toBe('Anime');
    expect(detail.created).toBe('Mar 29, 2007');
    expect(detail.staff).toEqual([
      { username: 'Xinil', url: 'https://myanimelist.net/profile/Xinil', role: 'President' },
      { username: 'daya', url: 'https://myanimelist.net/profile/daya', role: 'Secretary' },
    ]);
  });
});
