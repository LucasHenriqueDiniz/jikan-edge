# Real corpus and production p95 — anime catalog

Date: 2026-07-26. Measured with `wrangler tail --format json` connected to the published Worker (`jikan-edge`, version `c429a5fd-46c3-4502-8f0e-c17cbaec4bd8`), capturing Cloudflare's real per-request `cpuTime`/`wallTime` — not the local microbenchmark over a synthetic fixture.

## Reference limit

Now confirmed in the official documentation (developers.cloudflare.com/workers/platform/limits): the **Free plan has a ceiling of 10 ms of CPU per request**; the paid plan goes to 30 s by default (configurable up to 5 min). The 8 ms margin already used in this project's local benchmarks is therefore a buffer of ~2 ms below the real ceiling — not an arbitrary margin.

## Anime detail (`GET /v1/anime/:id`) — 8 real IDs, all cache misses

The corpus was chosen for diversity of size and popularity: very long franchises, one film and mid-sized titles.

| mal_id | Title | cpuTime (ms) | wallTime (ms) |
| ---: | --- | ---: | ---: |
| 21 | One Piece | **8** | **5314** |
| 269 | Bleach | 6 | 1760 |
| 52991 | Sousou no Frieren | 5 | 1635 |
| 20 | Naruto | 6 | 1525 |
| 9253 | Steins;Gate | 5 | 1466 |
| 30 | Neon Genesis Evangelion | 6 | 1487 |
| 5114 | Fullmetal Alchemist: Brotherhood | 5 | 1422 |
| 199 | Sen to Chihiro no Kamikakushi (Spirited Away) | 6 | 1347 |

- cpuTime: min 5 ms, p50 6 ms, **p95 8 ms**, max 8 ms.
- wallTime: min 1347 ms, median ~1487 ms, **One Piece is an outlier at 5314 ms** — 3 to 4× the rest of the corpus.

**Risk identified:** One Piece's cpuTime (8 ms) is already brushing the Free plan's real ceiling (10 ms), not just the provisional 8 ms margin. The parser (`parseAnimeDetail`) already limits its own reading to `html.slice(0, 60_000)`, so the extra cost does not come from regex extraction — it comes from `MalClient.getHtml` doing `response.text()` over the **entire** body before any cut (up to the `maxUpstreamBytes` ceiling, 2 MiB). Pages of very large franchises appear to be proportionally heavier to download and decode, not to parse. That also explains the 3-4× larger wallTime — more bytes travelling and being decoded, still well inside the 8 s timeout (`sourceTimeoutMs`), but without generous headroom.

Small sample (n=8): it serves as a first real corpus, not as a statistically robust p95. It is recommended to expand to at least ~20-30 real IDs, including more franchises with hundreds or thousands of episodes, before treating this number as definitive.

## Top anime (`GET /v1/top/anime?page=`) — 4 real pages, all cache misses

| Page | cpuTime (ms) | wallTime (ms) |
| ---: | ---: | ---: |
| 2 | 5 | 1369 |
| 3 | 6 | 1365 |
| 4 | 6 | 1364 |
| 5 | 7 | 1344 |

cpuTime: min 5 ms, p50 6 ms, p95 7 ms. wallTime is extremely stable (~1.34-1.37 s) — expected, since each MAL page has exactly 50 rows of comparable size. Low risk, good headroom against the 10 ms ceiling.

## Genres and current season — a measurement limitation

`GET /v1/genres/anime` and `GET /v1/seasons/now` could only be measured on a **cache hit** in this round (cpuTime 1 ms, wallTime 157–190 ms) — both already had a warm 6 h TTL from the deploy, and this API has no cache-bypass mechanism to force a new miss on demand. Each one's real miss happened during the post-deploy smoke test, before `wrangler tail` was connected, so we do not have the real `cpuTime` of that specific fetch+parse — only qualitative confirmation that it worked (payloads of 1,226 and 39,060 bytes respectively).

Unlike anime detail and top anime, these two resources are **singletons** (there is only one "genres" page and one "current season" page on MAL at any moment) — there is no corpus of variations to sample; the only way to capture the miss's real cpuTime is to wait for the next natural TTL expiry (~6 h) with the tail already connected.

## `MalClient` optimization attempt (reverted)

After this initial measurement, I tried optimizing `MalClient.getHtml` to read only a prefix of the body via a stream (`response.body.getReader()`) instead of a complete `response.text()`, since `parseAnimeDetail` only uses the first ~55 KB of any real page tested. The idea was to reduce download/decoding cost for large franchises like One Piece.

**This was reverted.** Measuring again in production with a fresh corpus (8 distinct IDs), two titles (Death Note, Violet Evergarden) showed a `cpuTime` of 13-14 ms — worse than the previous worst case (8 ms), with no correlation to the document's real size (Hunter x Hunter, 250 KB, came in at 5 ms). I tried a second version (accumulating the raw chunks and decoding once at the end, instead of decoding per chunk) — the same spike pattern continued (15 ms on two different titles).

**Before accepting "stream reading makes things worse" as a conclusion, I tested the reverted code (back to plain `response.text()`) with one more fresh corpus — and the same kind of spike (15 ms, Code Geass R2) showed up there too.** In other words: the 13-15 ms spikes are not caused by the optimization attempt — they happen sporadically in the original implementation as well. I ruled out the parser (`parseAnimeDetail` ran in ~0.5 ms against Code Geass R2's real HTML in a local test, far below the 15 ms observed in production). The most likely cause is outside the application's code — cold-start/isolate variance in Cloudflare's runtime, or how MAL's `Transfer-Encoding: chunked` is delivered by Cloudflare's edge in specific cases — and it was not isolated in that session.

**Final state:** the code went back to the original `response.text()` (no partial reading). The only real gain left by this investigation was a genuine bug found along the way: some MAL pages use the singular label `Genre:`/`Studio:` instead of `Genres:`/`Studios:` (e.g. Violet Evergarden), which broke both the required marker and the extraction — fixed in `anime-detail.parser.ts` and `anime.service.ts`, with a regression test (`detail-singular-labels.html`).

## Recommendations (from the initial round — partly superseded by the remeasurement below)

1. Treat the anime detail corpus as preliminary (now n=24 across the three rounds, but measured under three different code versions) — expand it with a single, stable corpus before any product decision that depends on this number.
2. It is **not worth** truncating the body read in `MalClient` — attempted and reverted in that session (see the section above). Spikes of 13-15 ms appeared in both the optimized and the original version; the cause is not in the application's code.
3. ~~Reschedule a real-miss measurement for `genres/anime` and `seasons/now` in the next TTL expiry window~~ — done in the remeasurement below (the singletons expired naturally and were measured as real misses).
4. The 13-15 ms spikes stopped being a risk with the upgrade to the Workers Paid plan (done 2026-07-26; the CPU ceiling went from 10 ms to 30 s).

## Post-full-parity remeasurement (2026-07-26, ~20:50 UTC-3, Workers Paid plan)

The same methodology (`wrangler tail --format json` connected before firing), now over the complete route surface (85 registered) on version `4e7e45f7`. A corpus of **49 real cache misses** covering every family — IDs and queries deliberately new, and the singleton resources (watch, reviews, recommendations, magazines, schedules) caught in a window after the 6 h TTL expired naturally, so those were genuine misses too.

### Overall aggregate (49 misses)

- cpuTime: **p50 7 ms, p95 27 ms, max 48 ms**. wallTime: typically 1.1–1.7 s (dominated by the upstream fetch), max 3.1 s (`manga?q=vagabond`).
- On the Free plan (10 ms ceiling), **11 of the 49 misses would have failed or landed in the danger zone** — the upgrade was not cosmetic.

### The heavy tail (all within the current 30 s ceiling, no risk)

| Route | cpuTime | Why |
| --- | ---: | --- |
| `/v1/manga/13/characters` (One Piece) | 48 ms | a huge character list from a long-running series |
| `/v1/people/1/full` (Tomokazu Seki) | 41 ms | a >1 MB page for a prolific voice actor + 4 parses over the same document |
| `/v1/magazines` | 27 ms | a directory of 1,445 magazines in a single document |
| `/v1/seasons/2025/winter` | 27 ms | a complete season (~200 cards) in a single document |
| `/v1/anime/5/characters` | 19 ms | characters + staff + voice actor tables |
| `/v1/schedules` | 18 ms | the same season format |

The pattern is consistent: the cost scales with document size and the number of items extracted, and there are no more unexplained outliers as there were in the Free plan round (the 13-15 ms spikes on small pages did not reappear anomalously — 14-15 ms now only shows up where the document justifies it).

### By family (cpuTime of the misses)

| Family | n | p50 | max |
| --- | ---: | ---: | ---: |
| Anime detail | 6 | 7 | 15 |
| Anime per-title sub-routes (full/characters/stats/pics/news/forum/reviews/recs/moreinfo) | 9 | 5 | 19 |
| Manga detail + sub-routes | 8 | 6.5 | 48 |
| Characters (detail/full/pictures/search) | 5 | 5 | 6 |
| People (detail/full) | 2 | — | 41 |
| Producers (detail/full) | 2 | — | 8 |
| Clubs (members) | 1 | — | 5 |
| Searches (anime/manga/users) | 3 | 6 | 10 |
| User (profile/friends/clubs/full/search) | 5 | 8 | 12 |
| Tops (anime/manga/people/characters, new pages) | 4 | 8 | 10 |
| Global lists (watch/reviews/recs/magazines/schedules/season) | 6 | 15.5 | 27 |
| Random (local, no fetch) | 1 | — | 0 |

### Observations from the round

- `/v1/anime/5/episodes` returned a **real 404 from MAL** — id 5 is a film (Cowboy Bebop: Tengoku no Tobira), which has no episodes page. Correct behavior, passed through faithfully.
- `/v1/clubs/5` returned 500 (`UPSTREAM_SUSPICIOUS`) — club id 5 apparently does not exist and `clubs.php?cid=5` does not answer with the expected structure. Worth a follow-up to map "nonexistent club" to a 404 instead of a 502/500, but that is error handling, not performance.
- `/v1/random/anime` cost **0 ms of cpuTime / 152 ms of wallTime** — as expected for a purely local D1 draw with no fetch.
- Cache hits remain at ~1 ms of cpuTime (e.g. `people?q=miyazaki`, a hit from the previous test session).
