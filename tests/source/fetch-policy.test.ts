import { describe, expect, it } from 'vitest';
import { CHARACTER_PAGE_BUDGET, refreshLeaseSecondsFor } from '../../src/source/fetch-policy';

// Sizes and fetch durations measured against the live pages on 2026-08-27. They are the reason the
// budget exists, so they are what it should be checked against — a budget that no longer admits the
// documents it was created for is the exact failure this replaced.
const MEASURED = {
  onePiece: { bytes: 10_359_313, edgeFetchMsWorst: 8_200 },
  detectiveConan: { bytes: 7_610_680, edgeFetchMsWorst: 5_000 },
};

describe('character page fetch budget', () => {
  it('admits the two titles a 5 MiB ceiling still refused', () => {
    for (const [title, page] of Object.entries(MEASURED)) {
      expect(CHARACTER_PAGE_BUDGET.maxBytes, `${title} must fit`).toBeGreaterThan(page.bytes);
      expect(CHARACTER_PAGE_BUDGET.timeoutMs, `${title} must have time to arrive`).toBeGreaterThan(page.edgeFetchMsWorst);
    }
  });

  it('leaves real headroom rather than fitting snugly around today\'s largest page', () => {
    // These pages only grow. A budget sized to the current worst case turns ordinary upstream
    // growth into a hard 502 on the day it is crossed, which is the bug this whole change came
    // from — so require margin explicitly instead of trusting that someone will notice.
    expect(CHARACTER_PAGE_BUDGET.maxBytes).toBeGreaterThan(MEASURED.onePiece.bytes * 1.5);
    expect(CHARACTER_PAGE_BUDGET.timeoutMs).toBeGreaterThan(MEASURED.onePiece.edgeFetchMsWorst * 2);
  });

  it('stays inside the runtime grace period even though a single attempt is all we allow', () => {
    // Cloudflare gives in-flight requests 30 s to finish when it updates the runtime. One attempt
    // on this budget fits; two would not, which is why a timeout on an extended budget is not
    // retried in mal-client.
    expect(CHARACTER_PAGE_BUDGET.timeoutMs).toBeLessThan(30_000);
    expect(CHARACTER_PAGE_BUDGET.timeoutMs * 2).toBeGreaterThan(30_000);
  });

  it('covers the whole refresh with the lock lease, not just the fetch', () => {
    // The lease has to outlast fetch + parse + D1 writes. If it expires mid-refresh a second
    // request reads the lock as abandoned and starts a redundant 10 MB download in parallel.
    expect(refreshLeaseSecondsFor(CHARACTER_PAGE_BUDGET) * 1_000).toBeGreaterThan(CHARACTER_PAGE_BUDGET.timeoutMs);
    expect(refreshLeaseSecondsFor(CHARACTER_PAGE_BUDGET)).toBeGreaterThan(30);
  });
});
