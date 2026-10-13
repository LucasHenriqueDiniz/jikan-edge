# Closing the Tenrai comparison gaps: what was run, on what data, and what came out

Date: 2026-10-11, rebased and re-run on 2026-10-13. Branch `fix/tenrai-comparison-gaps`, not deployed. Pitch:
[`docs/pitches/tenrai-comparison-gaps.md`](../pitches/tenrai-comparison-gaps.md). Research:
[`docs/research/2026-10-11-tenrai-gap-probes/`](../research/2026-10-11-tenrai-gap-probes/research.md).

## How it was tested

| layer | what ran | result |
| --- | --- | --- |
| unit | `npx vitest run` | **436 / 436** after rebasing onto `origin/main` (429 / 429 before the rebase; 355 before the batch) |
| integration | `npx vitest run --config vitest.integration.config.ts` — Workers D1, every migration applied including `0013` | **29 / 29** |
| mutation | each fix reverted on its own, the test that should catch it run, the file restored | **26 / 26** reverts turned a test red, before and after the rebase |
| migration | `0001`–`0012` on a fresh SQLite, ten rows seeded in the old shapes, then `0013` applied twice | old-shape rows rewritten, already-new rows untouched, second run a no-op |
| end to end | `wrangler dev --local` (local D1, real fetches to MyAnimeList), each answer compared with the live MAL page or with Tenrai where Tenrai matched MAL, and with production as "before" | **50 / 50** on the rebased code, `cache_entries` cleared first so every route took the refresh path |
| regression | the 73 route variations of the original comparison, local against production | **0 / 73** non-200, before and after the rebase; every count that changed is listed below |
| contract | `site/openapi.json` linted with `@redocly/cli@2.60.0 lint --extends=minimal` | valid, **0** warnings |
| static | `tsc --noEmit`, `biome check --error-on-warnings`, `wrangler deploy --dry-run` | clean; bundle 495 KiB / 89 KiB gzip |

The suite alone proves only that the code agrees with what the tests believe; it passed with every one of
these defects in production. The numbers that matter are the end-to-end ones.

## End to end, before and after

"Before" is production on the same day; "truth" is the live MAL page unless stated.

| check | before | after | truth |
| --- | --- | --- | --- |
| `anime/21/relations` | 2 | 94 | 94 |
| `manga/2/relations` | 7 | 9 | 9 (Tenrai) |
| `anime/21`, `235`, `1735` synopsis | null ×3 | present ×3 | present |
| characters 40, 417, 62, 17, 246: favourites / kanji / About | null / null / empty ×5 | all present | matches the page (favourites within 0.1% — they move live) |
| `characters/40` name | `Luffy "Mugiwara, Straw Hat" Monkey D.` | `Luffy Monkey D.` + `nicknames` | og:title |
| `anime/21/episodes` page 1 rows / Filler flags | 89 / — | 100 / 11 | 100 / 11 |
| episodes pages 2, 12, 13 | — | 101–200; 80 rows, `hasNextPage: false`; 200 `[]` | 1,180 episodes |
| `anime/21/episodes/99999` | 200, all null | 404 | no such episode |
| `characters/99999999` | 502 | 404 | invalid id |
| no-match search, past-the-end search, top, top people, user search, reviews feed, title reviews (anime and manga), character search | 404 / 502 / 503, and **200 with page 1's reviews** for `anime/21/reviews?page=999` | 200 `[]` on all eleven | nothing there |
| `anime/47571/reviews` (nobody reviewed it) | 502 | 200 `[]` | "No reviews have been submitted" |
| `anime/21/reviews?preliminary=false` | 400 | 200, 0 reviews | 0 (Tenrai's default) |
| `?spoilers=true` | 400 | 2 spoiler reviews | present on MAL with the toggle |
| review ids / reactions | absent | 20/20 ids; 14 of 50 feed cards with reactions, 36 null | as printed |
| search: members within 1% of Tenrai / ISO start dates | absent | 4/4 / 4/4 | — |
| `anime?q=86` | 404 | 41457, 48569, 50475, 49235 (+ *GR86 x Initial D*, a substring match) | the four *86* titles |
| `type=cm` / manga `type=novel` | 400 / Light Novel | CM only / Novel only | — |
| `seasons/now` continuing flags | absent | 45 | 45 in "TV (Continuing)" |
| `seasons/now?continuing=false` | 400 | 120 | 120 (Tenrai's default) |
| `people/1` | `"Seki Mondoya, 門戸 開, Monto Hiraku"`, `@ seki0908` | a 3-name list, `birthDate: 1972-09-08`, `@seki0908` | — |
| `/openapi.json` | 404 | 200, 98 paths, `Access-Control-Allow-Origin: *` | — |
| exact-title search `anime?q=Lv999+no+Murabito` / `manga?q=Oyasumi+Punpun` (MAL redirects both to the detail page) | 200, one entry, without the new fields | 200, one entry with `startDate`, `members`, `rating: "PG-13"` / `chapters: 147` | the detail page |

## Regression sweep: the counts that changed

17 of the 73 variations returned a different count from production. Every one is intended, or is not ours:

- relations: `anime/21`, `/full`, `/relations` (2 → 94); `anime/52991/full` (2 → 5); `manga/2`, `/full`, `/relations` (7 → 9);
- `anime/21/episodes` (89 → 100);
- new fields: `nicknames` on `characters/40` and `/full`; `alternateNames` as a list on `people/1` and `/full`;
- `random/*`: a different random pick on each side, so not comparable;
- `schedules` Monday (8 → 7): data, not code. The live MAL page lists 7, and production cached 8 four hours earlier.

## The rebase

The branch was cut from a local `main` that was 14 commits behind `origin/main`. Upstream had
meanwhile fixed exact-title search (issue #16) by routing on the landing URL, and had added
`SourceMetadata.finalUrl` itself — set on every fetch, where this branch set it only on a redirect.
The merge keeps upstream's field (`landedOnAnotherPage` works with either) and its routing, adds this
branch's zero-results handling and short-query quoting in front of it, and makes the detail →
search-entry mappers fill the new columns, with the detail's long rating reduced to the table's
short form. Every number above was re-measured after the rebase.

## What the testing caught that the plan did not

- **Manga reviews broke.** The first marker for title reviews was the anime page's `<h2>Reviews</h2>`, which manga
  pages do not have: `manga/2/reviews` went from 200 to 502. Only the 73-route regression sweep showed it. The
  marker is now the sort bar both pages carry. The same check found that manga answers a review page past
  the end with a **404**, not anime's 303.
- **A partial date was being thrown away.** MAL prints an announced title as `10-??-27`; the first version
  turned that into `null`. It is `2027-10` now, which is also what Tenrai returns.
- **An unknown review progress.** The parser was right to give `null` for `Preliminary (Unknown/? eps)`; the
  first test assumed every preliminary review prints a number.

## Not covered

- Production. Nothing here was deployed, and `wrangler dev --remote` was deliberately not used for the app: it
  writes to the production D1. The end-to-end run went through the machine's network, not Cloudflare's; the
  research had already shown the pages involved arrive the same way at the edge, in one colo.
- The CPU cost of reading fields from their own marker instead of a fixed prefix, on the Free plan's 10 ms.
