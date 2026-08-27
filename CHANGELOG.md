# Changelog

Changes that matter to anyone **consuming** the API. The technical detail behind each item — including the evidence each decision rests on — lives in [`docs/routes.md`](docs/routes.md).

`jikan-edge` ships by continuous deploy to Cloudflare Workers, with no versioned releases, so sections are dated rather than numbered. Each one names the published version id, which is the real unit of delivery.

This file starts on 2026-07-30 and does not reconstruct earlier history.

## 2026-08-27

Published versions: `4ce71084`, `9d3445dd`, `a07e0742`, `629508ce`, `ebeba400`, `5b41891e`,
`f2b389cd`, `086145f9`, `2139e894`, `9679c755`, `44d028aa`, `0523faba`, `b9cf7782`, `f7d1a163`,
`feaf775d`, `aa5baaa9`. The deploy publishing this filled-in line is not named — an entry can never
name the version that ships it, the same structural gap as the 2026-08-16 section.

Of those, six carried the changes below: `629508ce` raised the size ceiling to 5 MiB, recovering
five of the seven affected titles, `5b41891e` added the per-call fetch budget that recovered the
remaining two, `9679c755` carried both the profile fix and the cache headers, `0523faba` the genre
fix, `f7d1a163` the seasonal media type, and `aa5baaa9` the random-route changes. The rest are
documentation and a line-ending correction, with no change in behaviour.

The `?sfw` item below was written on 2026-08-26 and merged the next morning. As with the 2026-08-16
section, the date here is the one it reached production, not the one it was written on.

### Added

- **Responses now carry `Cache-Control` and `ETag`, so they can finally be cached and
  revalidated.** Until now not one response carried either, which made every route uncacheable by
  omission: browsers, CDNs and your own HTTP client had no way to reuse an answer or to ask whether
  it had changed, so a client polling a route re-downloaded an identical body every time.

  `Cache-Control` states the freshness that **remains**, not the full TTL — a resource fetched five
  hours into its six-hour life advertises one hour, so a shared cache cannot keep serving it long
  after this API considers it stale. It also carries `stale-while-revalidate`, which lets a shared
  cache keep answering during a refresh instead of making a caller wait on MyAnimeList.

  `ETag` enables conditional requests. Send it back as `If-None-Match` and an unchanged resource
  answers `304` with no body — on `GET /v1/anime/21/characters` that is **1,132,672 bytes down to
  0**. All the header's real forms work: a list, `*`, and `W/` weak tags.

  **Two things are deliberately never cached.** Errors are `no-store`, so an upstream outage or a
  rate-limit answer cannot outlive the condition that caused it. `/v1/random/*` is `no-store` too —
  a shared cache storing those would pin one entity and serve it to everyone, which is the opposite
  of what the route promises.

  **Nothing about the bodies changed**, and no request that worked before behaves differently. If
  you ignore the new headers you get exactly what you got yesterday.

### Changed

- **The request that trips a cache expiry is no longer the one that pays for the refresh.** When a
  resource's six-hour lifetime lapsed, the next caller waited out the full fetch from MyAnimeList —
  seconds — while everyone arriving beside them was handed the stored copy instantly. The penalty
  landed on whoever got there first, which is backwards.

  That caller now gets the stored copy immediately too, and the refresh runs after the response is
  sent. Measured on one route with a 60-second lifetime: the first request past expiry went from
  doing a cold fetch's work to **686 ms**, and the request after it already saw the refreshed
  copy. Nothing else about the answer changed — it is flagged `"stale": true` exactly as the
  concurrent case already was, and `Cache-Control` still says `max-age=0` so your own cache
  revalidates.

  **A resource that has been expired for longer than its own lifetime is not served this way** —
  there the caller waits and gets fresh data, because handing back something that old is worse than
  the wait. That boundary is the same one `stale-while-revalidate` in the header already advertised.

  This does not apply after a parser fix either: when the stored copy predates a correction, callers
  wait and get the corrected value rather than the old one one last time.

- **The five `/v1/random/*` routes now all answer the same `meta` shape.** Four of them
  (`anime`, `manga`, `characters`, `people`) returned `meta: { requestId }` while
  `/v1/random/users` returned the standard `cached`, `stale`, `refreshFailed` and `fetchedAt`. A
  client reading `meta.fetchedAt` got `undefined` on four routes of the same group and a real value
  on the fifth. All five now return the standard four fields.

  **`requestId` is gone from the body of those four successful responses.** It was the only one of
  93 successful responses in this API that carried it — `requestId` belongs to error bodies, where
  it is the handle to quote in a bug report, and every error still carries it. If you were reading
  it from a `200` on these routes, it was available nowhere else, so nothing else in your code
  depended on it.

  `stale` on those four is worked out from the age of the stored entity, because they are the only
  reads that never refresh: a pick can hand you something scraped weeks ago, and now says so.
  `cached` is always `true` and `refreshFailed` always `false` — the entity comes from the local
  catalogue and nothing was fetched to get it.

### Fixed

- **`GET /v1/random/users` was cacheable, which made it not random.** It answered
  `Cache-Control: public, max-age=21599`, so a shared cache or CDN would store one "random" user and
  hand that same profile to everyone for six hours. The other four picks already said `no-store`;
  this one reads a real profile through the normal caching path and inherited that profile's
  lifetime. It now says `no-store` like the rest of the group.

- **Every seasonal entry said its `type` was `null`.** All 891 entries across `GET /v1/seasons/now`,
  `/v1/seasons/upcoming` and `/v1/seasons/:year/:season`, plus all 130 in `GET /v1/schedules`,
  reported `"type": null`. Not one entry in the group had a type, so anything that sorted or grouped
  by media type — TV versus movie versus ONA — had nothing to work with.

  They now carry the same value the detail route gives for the same anime: `TV`, `OVA`, `Movie`,
  `Special`, `ONA`, `TV Special`, or `Unknown` where MyAnimeList itself says unknown (61 of the 415
  upcoming entries, which is the honest answer for a show that has not announced a format yet).
  Verified across 1,021 live entries with no nulls left, and one sample of each type checked against
  `/v1/anime/:id`.

  Cached seasons and schedules refresh into the new shape on their next read.

- **Browsing by genre alone returned nothing, for every genre and both media types.** `GET
  /v1/anime?genres=1` answered `200` with `"data": []` — for Action, which has 5012 titles by this
  API's own `/v1/genres/anime` count. `GET /v1/manga?genres=1` did the same. Every genre id was
  affected. You were told "nothing matches", which is worse than an error: a plausible wrong answer
  is one you have no reason to question.

  It only broke when a genre was the **whole** request. Adding anything at all — `q`, `type`,
  `order_by`, or just asking for page 2 — worked, which is why the fault could sit there unnoticed:
  `?genres=1` returned 0 items while `?genres=1&page=2` returned 50.

  MyAnimeList redirects a request whose only parameter is one genre to its genre-browsing page,
  which is a different page with different markup, and the results parser found no rows there.
  Requests now carry the same category field MyAnimeList's own search form sends, so a genre-only
  search stays on the search page. Nothing else about search changed: the same queries return the
  same results in the same order.

  **The guard that should have caught it was also fixed.** The check that decides whether an
  upstream page is the page we asked for was weak enough to accept the genre-browsing page. It now
  rejects it, so this class of mistake answers `502 UPSTREAM_SUSPICIOUS` instead of an empty list. A
  search that genuinely matches nothing still returns an empty list, as before.

  Empty results already cached for a genre-only search are discarded rather than served out for the
  rest of their lifetime.

- **User profiles were missing their avatar and their About text — for every user.** `GET
  /v1/users/:username` returned `avatarUrl: null` and `about: null`, and
  `GET /v1/users/:username/about` returned `{ "about": null }`, no matter whose profile you asked
  for. Both fields are now populated whenever MyAnimeList actually has them.

  These were two unrelated faults that happened to land on the same page. The avatar was searched
  for only in the first 30,000 characters of the profile, and it sits right around that boundary —
  so whether you got an avatar was decided by a few dozen bytes of unrelated markup further up the
  page. The About text was looked up by searching for the heading `About Me`, which does not appear
  anywhere on a MyAnimeList profile, so that field could never have been anything but null.

  **`null` still means null.** A user with no profile picture, or who has written no About, still
  gets `null` for that field — the fix does not invent content. Verified against real profiles in
  both directions.

  If you worked around these by treating the fields as unavailable, you can stop. Cached profiles
  refresh into the new shape on their next read rather than all at once.

- **One Piece and Detective Conan now return their cast and staff too.** These were the two titles
  the earlier fix in this same section could not reach — 9.9 MB and 7.3 MB, past both the 5 MiB
  ceiling and the 8-second upstream timeout. `GET /v1/anime/21/staff` returns **541 staff members**
  and `/characters` returns **1482**; Detective Conan returns 471 and 2110. Every route listed as
  broken earlier today now works.

  This also makes the staff fix announced on 2026-08-16 real for the first time: it promised the
  full One Piece staff list instead of the first 80, and that route has been answering `502` ever
  since, so nobody ever received the fix. 541 is the number it was written for.

  Rather than loosen the limits for all 96 routes, the character-page fetch now asks for its own
  budget (20 s, 16 MiB) while the global defaults stay at 8 s and 5 MiB — a runaway document on any
  other route still gets caught. **One consequence worth knowing if you time out clients:** a cold
  request for One Piece takes around 7 seconds, because the page genuinely is 10 MB. Cached
  requests are unaffected, and the 6-hour TTL means almost all of them are cached.

  **No response shape changes**, and nothing that worked before behaves differently.

- **The longest-running series returned `502` for their entire cast and staff.** `GET
  /v1/anime/:id/characters` and `/staff` answered `502 UPSTREAM_SUSPICIOUS` for **One Piece,
  Detective Conan, Naruto, Naruto Shippuden, Bleach, Pokémon and Fairy Tail** — both routes read
  the same MyAnimeList page, so both failed together. The page for these titles is simply larger
  than the 2 MiB ceiling this API imposed on any upstream document; that ceiling is now 5 MiB.

  **Five of the seven are fixed** (Naruto, Fairy Tail, Bleach, Pokémon, Naruto Shippuden), along
  with the titles that were about to cross the same line — Dragon Ball Z sat at 96 % of the old
  limit and One Piece's *manga* page at 91 %, both answering `200` only by luck of timing.
  **One Piece and Detective Conan still fail**, at 9.9 MB and 7.3 MB: those are held back by the
  8-second upstream timeout rather than by the size limit, and lifting that safely is a separate
  change. If you consume those two titles, this release does not yet help you.

  There was never any cached data behind these routes to fall back on, so this was a hard error
  rather than stale data — and it means the One Piece staff fix announced on 2026-08-16 ("returned
  80 of One Piece's 542 staff members") has in fact never been reachable in production for that
  title. It becomes reachable when the timeout change lands.

  **No response shape changes.** Requests that already worked return exactly what they returned
  before; the parser was never the problem.

- **`?sfw` pointed you at a parameter that is also refused.** The `400 UNSUPPORTED_PARAMETER` for
  `sfw` ended with `Use "genres_exclude" or "rating".`, but `genres_exclude` is refused by this same
  API — taking the advice bought a second request and the same wall. The message now names only
  `rating`, and says it applies to anime search (`GET /v1/anime`), since MyAnimeList's manga search
  page carries no classification field. **Error text only:** the same requests are accepted and
  refused as before.

## 2026-08-18

Published versions: `3810fd7b`, `96e592e6`, `5fb481a6`, `40959124`, `b0e3ba13`, `b689413b`,
`3d97bdf8`, `2d4f3446`, `c214be3f`.

Nine for three changes, because each one shipped twice: the Cloudflare Git integration deploys on
every push to `main`, and these were also deployed by hand. The push-triggered build is the one
that ends up serving, since it lands last. Deploying manually before pushing is redundant here.

### Changed

- **New base URL: `https://jikan.lucashdo.com`.** All documentation, the landing page and `llms.txt`
  now point there. **Nothing breaks:** `https://jikan-edge.lucas-hdo.workers.dev` still serves the
  exact same Worker, on the same D1 cache, and is not scheduled for removal — no redirect, no
  deprecation window, no action required from existing integrations. The custom domain is additive
  (`workers_dev` stays `true`); prefer it for new work so a future move off `*.workers.dev` costs
  nothing.

- **`MAL_USER_AGENT` now identifies the API as `jikan-edge/0.1 (+https://jikan.lucashdo.com)`.**
  Only MyAnimeList sees this; no response changes.

### Fixed

- **Self-hosting: `npm run setup` empties the `routes` list.** Without it a fork would inherit the
  maintainer's custom domain and `wrangler deploy` would fail on a zone it cannot claim.

## 2026-08-16

Published versions: `d75c8e94`, `80846de6`, `3853a33d`.

`3853a33d` carried no code — it is the deploy that published this entry, and it was added here on
2026-08-18, after the fact. An entry cannot name the version that ships it, so the last id of any
day has to be filled in afterwards; the gap is expected, not a missing release.

Everything here except the last two entries was written on **2026-08-10** and only reached production
today. The deploy pipeline itself was broken: a stray `pnpm-workspace.yaml` made every Cloudflare
build fail while installing dependencies, so no build had succeeded since the Git integration was
connected on that date, and production kept serving code from 2026-07-31. If you consume this API,
these are fixes you had not been getting yet — not fixes you already had.

### Fixed

- **Opening and ending themes came back empty.** `GET /v1/anime/:id/full` and `/themes` answered
  `{ "openings": [], "endings": [] }` for titles whose theme widget MAL has already migrated —
  Frieren returned nothing at all, and Fullmetal Alchemist: Brotherhood, which carries both markups
  on the same page, lost half its themes. Both formats are now read per line rather than per page.

- **Staff lists stopped at the first 80 KB of the page.** `GET /v1/anime/:id/staff` returned 80 of
  One Piece's 542 staff members — ~85 % dropped with a `200` and no indication anything was missing.
  The cut now falls at the next real heading, or at the end of the document.

- **`GET /health` accepted query parameters it documents as invalid.** `?anything=1` answered `200`
  instead of `400`; the guard existed but was registered after the route, so it never ran.

- **A database blip could hide data that had already been saved.** When the refreshed value was
  stored but the bookkeeping write that follows it failed, the response fell back to the **previous**
  value labelled `refreshFailed: true`, even though the new one was already in the database.

- **User search answered `500` on an unrecognised page.** `GET /v1/users?q=` now answers
  `502 UPSTREAM_SUSPICIOUS`, and no longer risks echoing the query back as if it were a username it
  had actually found.

- **`background` ended with a stray "Edit".** Every anime with a Background section carried the
  next section's edit link as the last word of the text — `"…anime aimed at adult audiences.\n\nEdit"`.
  Cached entries keep the old value until their 6 h TTL expires; nothing else changes about the field.

### Changed

- **`ClubDetail.staff` is now `{ username, url, role }[]`**, where it used to be strings shaped like
  `"Name (Role)"`. `GET /v1/clubs/:id` and `/staff` are affected. The profile link was always in the
  markup and was being thrown away, and the concatenated form was ambiguous whenever a name or a role
  contained parentheses.

### Operational notes

- Detail, `full` and the media sub-routes of the same entity now prime each other's cache, so asking
  for `/full` right after `/detail` no longer triggers a second fetch of the same page upstream. No
  response shape or value changes.
- Failed upstream requests are retried once, but only for connection errors and timeouts — never for
  answers MAL gave deliberately (not found, private, rate limited).
- One migration ships, `0012`, and it only repairs stored bookkeeping: the parser version recorded
  for user update rows, which had been frozen at its first value.

## 2026-07-30 (second release of the day)

Published versions: `42f848f4`, `c098b3b5`, `1320a613`, `89bfcadc`, `cdcce2cd`, `499408ac`, `53c31b76`.

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
