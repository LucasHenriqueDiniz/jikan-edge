# Changelog

Changes that matter to anyone **consuming** the API. The technical detail behind each item — including the evidence each decision rests on — lives in [`docs/routes.md`](docs/routes.md).

`jikan-edge` ships by continuous deploy to Cloudflare Workers, with no versioned releases, so sections are dated rather than numbered. Each one names the published version id, which is the real unit of delivery.

This file starts on 2026-07-30 and does not reconstruct earlier history.

## 2026-07-30

Published versions: `116479bb`, `7d5fea93`, `f2185eaf`.

A day on a single theme: data that existed at the source and the API either withheld or got wrong without saying so. Found by sweeping all 98 routes in production, not by a bug report.

### ⚠️ Breaking

- **`sourceVersion` is gone from every response.** The field appeared on profiles, statistics, list entries and on anime, manga, character, person, club and producer details. It published the internal cache-invalidation token (`user-html-v3`, `anime-html-v1`, …) and was being read as the API version — which is the `v1` in the path and **has never changed**. If you read this field, stop: it was never contract. The cache mechanism is untouched; it simply stopped being public.

  For a few hours after the first deploy the field still showed up in responses served from rows written before the change. A migration now strips it from those rows, so it is gone everywhere rather than fading out over a TTL cycle.

### Fixed

- **User lists returned 502 for a large share of accounts.** `GET /v1/users/:username/animelist` and `/mangalist` failed for every user whose profile uses MAL's **modern** list layout — which is the user's own setting, not something wrong with the page. The parser only recognised classic-layout markup.

- **The classic layout was dropping entries silently.** Worse than the 502, because it answered 200: without the `?status=7` parameter, MAL's page serves fewer entries than the profile declares.

  | User | Layout | Before | Now | Profile declares |
  | --- | --- | ---: | ---: | ---: |
  | Xinil | modern | 502 | 399 | 399 |
  | Karinyia | modern | 502 | 2,354 | 2,354 |
  | jet2r0cks | modern | 502 | 898 | 898 |
  | AMayacrab | classic | **273** (no error) | 360 | 360 |
  | Zel | classic | 514 | 514 | 514 |

- **An anime titled "86" took down an entire list.** MAL leaves a numeric-looking title unquoted, so `86` (*86 Eighty-Six*), `1` and `663114` arrive as JSON numbers. The title came out empty, failed validation — and since one invalid item rejects the whole page, a 2,354-entry list fell over because of a single row.

- **Profile statistics could serve a manga number as if it were the anime one.** Extraction used a fixed 8 KB window from `Anime Stats`, and `Manga Stats` sits ~2 KB away — inside it. With every row present the answer came out right by luck of match order; MAL omitting or renaming one row was enough to serve the wrong value with no error at all.

- **`daysWatched`, `rewatched`, `daysRead` and `reread` were never emitted** by `GET /v1/users/:username/statistics`. Not a source limitation — all four have always been in the same profile HTML the API already fetched.

### Added

- **List entries carry more fields** when they come from the modern layout: `status` (`watching`/`reading`, `completed`, `on hold`, `dropped`, `plan to watch`/`plan to read`), `total`, `startedAt`, `finishedAt` and `updatedAt`. On the classic layout they stay `null`, because the page does not expose them — a deliberate asymmetry: an honest `null` beats an invented value.

- **New `501 LIST_TOO_LARGE` error** when a list runs past the 6,000 entries the API reads in one refresh. It is the only code that does not come from the source. Before this limit existed explicitly, the overflow was truncated silently.

- **`GET /v1/genres/anime` and `GET /v1/genres/manga` work.** They used to return 500 — MAL serves the genre sidebar of its browse pages truncated to ~12 entries for requests coming from Cloudflare's network, and the API refuses to cache a partial taxonomy as if it were whole. The full taxonomy turned out to be on a different public page (the search page's content filter), which arrives intact: **78 entries for anime, 79 for manga**, verified from Cloudflare's own network rather than from a developer machine.

  Each entry now carries `count` (titles in that genre) and `type` — `genres`, `explicit_genres`, `themes` or `demographics`, the same four categories Jikan uses — and `?filter=` narrows the list to one of them (`400 INVALID_FILTER` otherwise). The ids are the ones the `genres` filter on anime/manga search expects.

- **A completeness guard on lists**: the assembled list is checked against the profile's own `totalEntries`. Extracting fewer entries than declared is now rejected with the counts in the message (`extracted 273 of 360`) instead of becoming an incomplete 200. Extracting more is accepted — a counter cached before the user added entries is legitimately behind.

### Operational notes

- The statistics fields needed no migration — they are JSON in columns that already existed. One migration did ship, and it only rewrites stored payloads: it strips the leftover `sourceVersion` key and drops the two cached genre rows, whose content was the old truncated taxonomy.
- The list cache version is separate from the profile one, so this fix invalidated lists only — cached profiles and statistics were not dragged into a mass refetch. The genre taxonomy has its own cache version too, for the same reason.

## Before 2026-07-30

Not covered here. Two earlier changes still catch consumers off guard and are described in [`docs/routes.md`](docs/routes.md): `GET /v1/schedules` without a filter began returning an object keyed by day instead of a flat list (2026-07-27), and favorites and `userupdates` began emitting `malId` instead of `mal_id`.
