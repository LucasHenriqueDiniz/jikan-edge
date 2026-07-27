import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStatistics } from '../../src/parsers/statistics.parser';

const html = readFileSync('tests/fixtures/statistics/anime-stats-valid.html', 'utf8');

describe('statistics parser', () => {
  it('normalizes summary and score stats', () => {
    const stats = parseStatistics(html, '2026-07-26T00:00:00.000Z');
    expect(stats.status).toEqual({
      inProgress: 190_984,
      completed: 1_205_137,
      onHold: 117_381,
      dropped: 49_938,
      planned: 511_281,
      total: 2_074_721,
    });
    expect(stats.scores).toEqual([
      { score: 10, votes: 370191, percentage: 34.6 },
      { score: 9, votes: 301804, percentage: 28.2 },
    ]);
  });
});
