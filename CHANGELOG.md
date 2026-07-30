# Changelog

Changes that matter to anyone **consuming** the API. The technical detail behind each item — including the evidence each decision rests on — lives in [`docs/routes.md`](docs/routes.md).

`jikan-edge` ships by continuous deploy to Cloudflare Workers, with no versioned releases, so sections are dated rather than numbered. Each one names the published version id, which is the real unit of delivery.

This file starts on 2026-07-30 and does not reconstruct earlier history.

## 2026-07-30 (second release of the day)

Published versions: `42f848f4`, `c098b3b5`, `1320a613`.

Two things landed together: the self-hosting fix below, and a content sweep that compared every
route against the official Jikan v4.

Prompted by [issue #1](https://github.com/LucasHenriqueDiniz/jikan-edge/issues/1): the first person to
self-host this got `500 INTERNAL_ERROR` on every route, and nothing in the response or the README
said why.

### Added

- **`GET /health` now reports `data.checks.database`** — `ok`, `not_migrated`, `not_configured` or
  `unavailable`. Additive: `status` and `service` are unchanged, and the route still answers `200`
  when the database is degraded, so uptime monitors keep reading it the same way.
- **A setup command for self-hosters**: `npm run setup` creates the D1 database, writes its id into
  `wrangler.jsonc` and applies the migrations. Full guide in
  [`docs/self-hosting.md`](docs/self-hosting.md), including the Free-plan CPU caveat.

### Fixed

- **A deploy with no schema no longer fails as an unexplained server error.** Every route reads the
  cache table first, so an un-migrated database produced `500 INTERNAL_ERROR` everywhere. Those two
  cases now answer `503` with `DATABASE_NOT_MIGRATED` or `DATABASE_NOT_CONFIGURED` and the command
  that fixes them. A genuine D1 outage still answers `500` — being told to re-run migrations you
  already ran is worse than being told nothing.

### Removed

- **The unused `SNAPSHOTS_BUCKET` R2 binding.** It was never referenced in the code, but it forced
  everyone cloning the project to create an R2 bucket. Nothing about the API changes; self-hosting
  loses a required step. If you already created the bucket, you can delete it.

---

The rest of this release comes from a second sweep: every route compared side by side against the
official `api.jikan.moe/v4` in the same window. No route was broken — all 98 answered `200`. What
turned up was **content**: data leaving thinner than the source, unusable, or wrong in a way nothing
flagged.

### ⚠️ Breaking

- **Genres, studios and authors are objects now, not strings.** `["Action", "Sci-Fi"]` became
  `[{ "malId": 1, "name": "Action", "url": "…" }]`. Applies to `genres`, `themes`, `demographics`,
  `studios`, `authors` and `producers`/`licensors` on anime and manga detail.

  This closes a loop that was broken inside the API itself: `GET /v1/anime?genres=1` has always
  taken numeric ids, but no response ever handed one back — you could filter by genre and never
  learn a title's genre ids. They were in the page all along, in the link this API was reading the
  name out of.

- **`serialization` is now `serializations`, and it is an array.** A manga can run in more than one
  magazine; a string could only ever hold the first.

- **`aired` and `published` are objects.** `"Apr 3, 1998 to Apr 24, 1999"` became
  `{ "from": "1998-04-03", "to": "1999-04-24", "string": "Apr 3, 1998 to Apr 24, 1999" }`. `string`
  keeps MAL's own wording, so nothing is lost. A date only appears when the page gives day, month
  and year — Berserk reads `"Aug 25, 1989 to ?"`, so its `to` is `null` rather than an invented one.

- **`GET /v1/manga?q=` returns `volumes` instead of `episodes`.** The old field was not merely
  misnamed: MAL's manga results table carries the **volume count** in the column this API was
  reading as episodes. Searching Fullmetal Alchemist returned `episodes: 27`, and 27 is its volume
  count (it has 116 chapters). Manga has no episodes; the number was real and the label was wrong.

- **A query parameter this API does not honour is now `400`, not a silent `200`.** `?limit=5`,
  `?sfw`, `?sort=asc` and `?min_score=8` used to answer `200` and do nothing, which is the one kind
  of divergence a caller cannot detect. Two codes tell the cases apart: `UNKNOWN_PARAMETER` for a
  name that does not exist, `UNSUPPORTED_PARAMETER` for one Jikan has and this API deliberately does
  not — with the reason in the message. `?limit=` still works on the two user list routes, which
  page over local storage rather than over a MyAnimeList page.

- **An invalid `page` or `limit` is `400` instead of being quietly corrected.** `?page=0`, `?page=abc`
  and `?page=-5` all used to become page 1 without a word; `?limit=99999` became 300. `page` is also
  capped at 1000 now — every distinct page number costs a real upstream request.

### Added

- **`url` on every entity**, carrying MAL's canonical link with its slug. Previously 78 of 95 routes
  gave no way to link back without rebuilding the URL by hand.
- **`images` on anime, manga, character and person detail**: `{ small, medium, large }`. The
  variants are **not** uniform on MAL's CDN — a character has no large, a person has no small, a
  producer logo has neither — so each is `null` where the CDN genuinely has nothing, never a
  derived URL that 404s.
- **Fields that were always on the page and never emitted**: `scoredBy` (how many votes are behind
  the score), `season`, `year`, `airing`/`publishing`, `broadcast`, `background`, `titleSynonyms`
  and `trailer`.
- **`meta.pagination` on every paginated route** — `{ page, limit, count, total, hasNextPage }`.
  Before, only the user lists had it and everything else returned a bare array with no way to know
  whether another page existed. `total` is a number only on the user lists, which are counted
  locally; elsewhere it is `null`, because MAL prints no total and deriving one would be invention.
- **Search filters `sort`, `letter`, `min_score`, `start_date`, `end_date` and `magazines`** (manga
  only). Dates take Jikan's `YYYY-MM-DD`. One edge belongs to the source rather than to us: an entry
  whose date MyAnimeList does not have is **included** by either bound rather than filtered out.
- **`order_by` went from 3 accepted values to 9**: `start_date`, `score`, `episodes`/`volumes`,
  `end_date`, `type`, `members`, `rating`, `mal_id`. `title` is deliberately absent — MyAnimeList
  returns the same order in both directions for it, so offering it would be a sort that does not
  sort.
- **`genres` with several ids means "has all of them", not "has any"** — that is MyAnimeList's
  behaviour, not a choice here: on "love", genre 12 returns 16 results and genre 49 returns 3, and
  the two together return zero.

### Withdrawn the same day

- **`genres_exclude` was announced earlier in this release and does not work.** The check behind it
  compared result *counts* — 17 without the flag, 20 with it — and stopped there. Comparing the
  actual entries, 16 of the 18 results are the same ones the un-inverted filter returns: MyAnimeList
  ignores the flag. It now answers `400` with that evidence in the message. The same investigation
  retired `producers`: the field exists on the search page but no longer filters — "gundam" with and
  without it returns the same set.

### Fixed

- **List routes served a 50×70 thumbnail where a poster exists.** 31 routes published the resized
  copy MAL embeds in its own tables — 2 KB where the same path holds 56 KB. `imageUrl` is now the
  original everywhere.
- **Long text arrived with every paragraph break flattened.** Synopses, `about` and `moreinfo` came
  through as one wall of text because tag stripping turned MAL's `<br>` into spaces. Cowboy Bebop's
  synopsis is 1,027 characters and had zero line breaks.
- **Some punctuation reached responses undecoded** — `&mdash;` was visible in `/v1/anime/5114` and
  `/v1/manga/2`. Related: entities were being decoded *before* tags were stripped, so a literal
  `&lt;b&gt;` written by a user turned into a real tag and was eaten.

### Known divergence, on purpose

- **`duration` keeps MAL's punctuation**: `"24 min. per ep."`, where Jikan prints `"24 min per ep"`.
  That is what the page says, and this API reports the source rather than tidying it.
- **`?filter=` on `/v1/top/anime` and `/v1/top/manga` takes different values per medium.** Anime
  accepts Jikan's four (`airing`, `upcoming`, `bypopularity`, `favorite`); manga accepts only
  `bypopularity` and `favorite`. That is not an omission: comparing the id sets, `publishing` and
  `upcoming` return the unfiltered manga list unchanged, because MAL's top-manga page has no such
  tab. Jikan lists all four; two of them do nothing there. Anything else is `400 INVALID_FILTER` —
  MAL ignores an unrecognised tab silently and serves the unfiltered list with a `200`, so passing
  the value through would answer with the wrong data and no way to tell.

## 2026-07-30

Published versions: `116479bb`, `7d5fea93`, `f2185eaf`, `48dbfd6a`, `400eff03`, `044942c8`.

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
