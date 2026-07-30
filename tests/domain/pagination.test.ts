import { describe, expect, it } from 'vitest';
import { MAX_PAGE, paginationMeta, parseLimitParam, parsePageParam } from '../../src/domain/pagination';
import { ServiceError } from '../../src/services/cacheable';

describe('parsePageParam', () => {
  it('defaults to the first page when absent or empty', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('')).toBe(1);
  });

  it('accepts a plain whole number', () => {
    expect(parsePageParam('7')).toBe(7);
  });

  // The previous parseInt-based version answered 1 to every one of these without a word — the test
  // this file used to hold actually asserted that `page=0` became page 1 and `limit=999` became 300.
  it.each(['abc', '0', '-5', '1.5', '1e9', ' 1', '+1'])('refuses %j instead of quietly reading it as page 1', (raw) => {
    expect(() => parsePageParam(raw)).toThrow(ServiceError);
  });

  it('caps the page number, since each distinct page costs an upstream fetch and a cache row', () => {
    expect(parsePageParam(String(MAX_PAGE))).toBe(MAX_PAGE);
    expect(() => parsePageParam(String(MAX_PAGE + 1))).toThrow(/between 1 and/);
  });
});

describe('parseLimitParam', () => {
  it('defaults to 100 and accepts the documented range', () => {
    expect(parseLimitParam(undefined)).toBe(100);
    expect(parseLimitParam('1')).toBe(1);
    expect(parseLimitParam('300')).toBe(300);
  });

  it('refuses out-of-range and non-numeric values rather than clamping them', () => {
    expect(() => parseLimitParam('301')).toThrow(ServiceError);
    expect(() => parseLimitParam('0')).toThrow(ServiceError);
    expect(() => parseLimitParam('abc')).toThrow(ServiceError);
  });
});

describe('paginationMeta', () => {
  it('reports no total for a MyAnimeList-paged route, and reads the next page off fullness', () => {
    expect(paginationMeta(2, 50, 50)).toEqual({ page: 2, limit: 50, count: 50, total: null, hasNextPage: true });
    expect(paginationMeta(2, 50, 31)).toMatchObject({ total: null, hasNextPage: false });
  });

  it('uses the real total where one exists, as on the user lists', () => {
    expect(paginationMeta(1, 100, 100, 399)).toEqual({ page: 1, limit: 100, count: 100, total: 399, hasNextPage: true });
    expect(paginationMeta(4, 100, 99, 399)).toMatchObject({ hasNextPage: false });
  });
});
