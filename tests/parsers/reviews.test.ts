import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseReviews } from '../../src/parsers/reviews.parser';

const html = readFileSync('tests/fixtures/reviews/anime-valid.html', 'utf8');

describe('reviews parser', () => {
  it('extracts review entries', () => {
    const entries = parseReviews(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      malId: 62512,
      title: 'Jidou Hanbaiki ni Umarekawatta Ore wa Meikyuu wo Samayou 3rd Season',
      username: 'Eleiyas',
      date: 'Jul 26, 2026',
      tag: 'Mixed Feelings',
      score: 7,
    });
    expect(entries[0].imageUrl).toContain('156697.jpg');
    expect(entries[0].reviewText).toContain('This finished over a month ago');
  });
});
