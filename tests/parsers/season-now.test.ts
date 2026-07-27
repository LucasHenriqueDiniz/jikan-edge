import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSeasonNow, parseSeasonNowSnapshot } from '../../src/parsers/season-now.parser';

const html = readFileSync('tests/fixtures/anime/season-now-valid.html', 'utf8');

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
