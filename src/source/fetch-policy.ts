import type { FetchBudget } from '../ports/driven/catalog-source.port';

/**
 * Per-call fetch budgets for MyAnimeList pages that are far larger than the norm.
 *
 * The global defaults in `wrangler.jsonc` (8 s, 5 MiB) are sized for the typical page, which is
 * well under a megabyte. A handful of pages are an order of magnitude bigger, and rather than
 * loosening the limits for all 96 routes — where a runaway document would then go unnoticed — the
 * routes that need more ask for it explicitly.
 */
// The type is the port's — it is a parameter of `getHtml`. What stays in this file is the policy:
// which pages get which budget, and why, measured against the live documents.
export type { FetchBudget };

/**
 * The `/characters` page of a long-running series, which `/staff` reads too.
 *
 * Measured against the live pages on 2026-08-27: One Piece is 9.88 MB and takes 6.4–8.2 s to reach
 * Cloudflare's edge, Detective Conan is 7.26 MB. Those two were the titles a 5 MiB / 8 s budget
 * still refused after the ceiling was raised for the rest.
 *
 * 16 MiB is deliberate headroom rather than a snug fit around One Piece: the whole reason this
 * limit needed revisiting is that a tight ceiling turns steady upstream growth into a hard 502 the
 * day it is crossed, with no warning. 20 s is ~2.5x the slowest fetch actually observed.
 *
 * Both are safe on the platform, per Cloudflare's published limits: HTTP-triggered Workers have no
 * wall-clock duration cap and no per-subrequest time limit, and time spent awaiting a fetch does
 * not count toward CPU time. Parsing 16 MiB costs ~140 ms of CPU at the measured 8.8 ms/MB, against
 * a 30 s CPU limit, and holds ~32 MB of heap against 128 MB.
 */
export const CHARACTER_PAGE_BUDGET: FetchBudget = { timeoutMs: 20_000, maxBytes: 16 * 1024 * 1024 };

/**
 * Lock lease covering one refresh that uses `budget`.
 *
 * Same reasoning as `listRefreshLeaseSeconds`: withCache's default 30 s lease is sized for a fetch
 * on the default 8 s budget. A lease that expires mid-refresh lets a second request read the lock
 * as abandoned and start a redundant scrape of the same page in parallel — which for these pages
 * means a second 10 MB download. Sized off the real budget plus headroom for parsing and D1 writes.
 */
export function refreshLeaseSecondsFor(budget: FetchBudget): number {
  return Math.ceil(budget.timeoutMs / 1_000) + 30;
}
