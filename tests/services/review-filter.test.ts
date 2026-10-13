import { describe, expect, it } from 'vitest';
import { parseReviewFilter } from '../../src/services/review-filter';

describe('review filter', () => {
  // No toggle means MAL's own defaults, the URL unchanged and the cache key unchanged — so a request
  // that asks for neither gets exactly what it got before these existed.
  it('adds nothing when neither toggle is given', () => {
    expect(parseReviewFilter(undefined, undefined)).toEqual({ params: [], key: '' });
  });

  it('sends both toggles once either is given, the other at MAL default', () => {
    expect(parseReviewFilter(undefined, 'true').params).toEqual([
      ['preliminary', 'on'],
      ['spoiler', 'on'],
    ]);
    expect(parseReviewFilter('false', undefined).params).toEqual([
      ['preliminary', 'off'],
      ['spoiler', 'off'],
    ]);
  });

  it('reads a bare flag as true, the way Jikan documents it', () => {
    expect(parseReviewFilter('', undefined).params[0]).toEqual(['preliminary', 'on']);
  });

  it('keys each combination apart', () => {
    expect(parseReviewFilter('false', 'true').key).toBe(':preliminary:false:spoilers:true');
    expect(parseReviewFilter('true', 'false').key).not.toBe(parseReviewFilter('false', 'false').key);
  });

  it('refuses anything that is not true or false', () => {
    expect(() => parseReviewFilter('yes', undefined)).toThrow('"preliminary" must be "true" or "false".');
    expect(() => parseReviewFilter(undefined, '1')).toThrow('"spoilers" must be "true" or "false".');
  });
});
