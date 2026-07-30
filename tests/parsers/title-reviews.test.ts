import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTitleReviews } from '../../src/parsers/title-reviews.parser';

const html = readFileSync('tests/fixtures/reviews/anime-title-reviews-valid.html', 'utf8');

describe('title reviews parser', () => {
  it('extracts review entries without a redundant title/malId field', () => {
    const reviews = parseTitleReviews(html);
    expect(reviews).toEqual([
      {
        username: 'TheLlama',
        imageUrl: 'https://cdn.myanimelist.net/s/common/userimages/35fb5f95-6a86-498b-93a5-fcff7f402bc2_225w',
        date: 'Aug 24, 2008',
        tag: 'Recommended',
        score: 10,
        reviewText: "People who know me know that I'm not a fan of episodic anime series.",
      },
    ]);
  });
});
