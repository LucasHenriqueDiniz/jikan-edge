import { describe, expect, it } from 'vitest';
import { listRefreshLeaseSeconds } from '../../src/services/user.service';

// mediaList can make up to MAX_LIST_PAGES (20) sequential upstream fetches, each bounded by
// sourceTimeoutMs. withCache's default lock lease is 30s, sized for a single fetch — sized off the
// real worst case here instead, so a healthy-but-slow refresh doesn't lose its lock mid-flight.
describe('listRefreshLeaseSeconds', () => {
  it('covers the worst case of 20 sequential page timeouts, not just one', () => {
    expect(listRefreshLeaseSeconds(8_000)).toBeGreaterThanOrEqual(20 * 8);
  });

  it('exceeds the 30s default lease that withCache would otherwise use', () => {
    expect(listRefreshLeaseSeconds(8_000)).toBeGreaterThan(30);
  });

  it('scales with a configured source timeout instead of a hardcoded default', () => {
    expect(listRefreshLeaseSeconds(20_000)).toBeGreaterThan(listRefreshLeaseSeconds(8_000));
  });
});
