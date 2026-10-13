---
tags:
  - pitch
  - parity
  - parsers
  - contract
status: active
kanban:
---

# Pitch — Close the gaps the Tenrai comparison exposed

## Problem

[Tenrai](https://api.tenrai.org/documentation) is a Jikan-v4-compatible API over a pre-crawled copy of
the MyAnimeList catalogue. On 2026-10-11 the two APIs were measured side by side: 73 route variations
covering the 70 routes both serve, plus 39 behaviour probes on each, with every divergence checked
against the live MAL page. `api.jikan.moe` did not answer during the run (15 s timeout), so Tenrai is
what someone porting from Jikan finds next.

**Every one of the 146 sweep calls returned 200 on both sides.** What showed up is the failure mode this
project already names as its most expensive: a 200 with wrong data. On the routes both APIs serve,
Tenrai is right in places where this API is wrong.

### Wrong data served as 200

| | Route | Here | Tenrai | Live MAL | Cause |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | `anime/21/relations` (also `/full` and the detail) | 2 | 94 | 94 | `src/parsers/relations-links.ts:6` reads only the `entry borderClass` tiles and never the `entries-table` underneath |
| | `manga/2/relations` | 7 | 9 | 9 | same cause: Spin-Off and Other are lost |
| 2 | `characters/40`, `417`, `62` | `nameKanji`, `favorites` and `about` all `null` | 150,076 favourites, 4 KB about | "Member Favorites" sits at byte 110,981 | `src/parsers/character-detail.parser.ts:47` keeps only the first 60 KB. Three of the six characters sampled fail — the ones with long pages |
| 3 | `anime/21/episodes` | 89 | 100 | 100 | `src/parsers/episodes.parser.ts:19`: a Filler or Recap row has a `<span>` before the `<a>`, the regex misses it, and the row is dropped without a trace |
| 4 | `people/1` `about` | `@ seki0908` | `@seki0908` | `@<a>seki0908</a>` | `richText` turns an inline tag into a space |

The 60 KB cut is not unique to characters. The same fixed window exists in `person-detail` (60 KB),
`producer-detail` (60 KB), `club-detail` (60 KB), `anime-detail` and `manga-detail` (90 KB),
`statistics` (120 KB) and `user-profile` (30 KB). Nobody has measured where each field actually sits on
the largest real page of each entity.

### Wrong status codes

| Request | Here | Tenrai |
| --- | --- | --- |
| Search with no match (`anime?q=zzqqxxyyvvkk`) | 404 `NOT_FOUND` "Unable to refresh this resource." | 200, `data: []` |
| Page past the end (`top/anime?page=700`, `anime?q=frieren&page=5`) | 404, same upstream-failure message | 200, `data: []`, `has_next_page: false` |
| Search shorter than 3 characters (`anime?q=86`) | 404, so the anime "86" cannot be found | 4 results |
| Episode that does not exist (`anime/21/episodes/99999`) | **200** with every field `null` and `aired: "N/A"` | 404 |
| Character that does not exist (`characters/99999999`) | 502 `UPSTREAM_SUSPICIOUS` | 404 |

A consumer cannot tell "nothing matched" from "MAL is broken", and gets a phantom episode for an id
that does not exist.

### Thin or raw payloads where the page already has the data

| Field | Here | Tenrai |
| --- | --- | --- |
| Search result entry | 8 fields | the full object (36 fields) |
| Review | 6 fields, no id, no url | `mal_id`, `url`, `reactions`, `is_spoiler`, `is_preliminary`, `episodes_watched` |
| Episode list | page 1 only, no filler/recap marker | paginated (12 pages for One Piece), `filler`, `recap` |
| Person | `alternateNames` is one string; `birthday` is `"Sep 8, 1972"` | an array; ISO 8601 |
| Character name | `Luffy "Mugiwara, Straw Hat" Monkey D.` — nicknames inside the name — while `top/characters` returns `Lamperouge, Lelouch` | `Monkey D., Luffy` plus `nicknames[]` |
| Season | `seasons/now` mixes continuing shows in unmarked (163 entries against Tenrai's 118) and refuses `continuing` with "no equivalent switch on the public pages" — **false**: the season page has a "TV (Continuing)" section | `continuing`, `kids` |

### No machine-readable contract

Tenrai publishes an OpenAPI 3 document with all 11 response codes declared on each of its 95 routes. This API
has `docs/routes.md`, `site/docs.html` and `llms.txt`, but nothing a client generator can consume —
even though `src/http/query-contract.ts` already holds the authoritative list of routes and parameters.

**Who it is wrong for:** WeebProfile first, then every third party and self-hoster comparing the
two APIs. On the routes we share, the comparison above is what they see. What only this API offers (27
routes of user data, clubs, watch, userupdates) does not make up for relations that are 2% complete.

## Solution

Four pieces of work, in priority order. Each one uses data from a page this API already fetches, or
from a public page within [[source-policy]]. None adds a fetch per entry, and none crawls.

1. **Correctness.** Fix rows 1–4 above. Then measure every fixed byte window in the detail parsers
   against the largest real page of its entity, fetched through Cloudflare's network, and remove or
   resize each window that cuts a field.
2. **Status codes.**
   - An empty search and a page past the end answer 200 with an empty list and
     `hasNextPage: false`.
   - An episode or character that does not exist answers 404. This also closes the
     nonexistent-club 404 already recorded as a follow-up.
   - A query too short for MAL's search gets an answer that says so. 400 or a fallback is open, see
     Research Needed.
3. **Richer payloads from the same pages.**
   - Search entries carry every column MAL's results page can show.
   - Reviews carry an id, a url, the spoiler and preliminary flags, and reactions.
   - Episodes carry `filler` and `recap`, and paginate.
   - People get an `alternateNames` array and an ISO birthday.
   - Characters split `nicknames` out of `name`.
   - Season entries say whether they are continuing, and `continuing` becomes a real parameter.
4. **An OpenAPI document**, generated from `QUERY_CONTRACT` and the response schemas rather than
   written by hand, served next to `llms.txt` and linked from `site/docs.html`.

## Architecture

The shape of the hexagon does not change.

- **Parsers (pure).** All of piece 1 and most of piece 3 lives here. Each fix gets a byte-for-byte
  excerpt of the real page as its fixture, and its own parser version bump.
- **Domain.** Gains the new fields: `filler`, `recap`, `nicknames`, `continuing`, review flags and
  search columns. It also changes two shapes: `alternateNames` becomes an array and `birthday` becomes
  ISO.
- **Services.** Piece 2 lives here: mapping "MAL returned 404 for an empty result or a page past the
  end" to an empty page, as opposed to a real upstream 404. Episode pagination follows the existing
  `:page:N` cache-key rule.
- **HTTP.** `QUERY_CONTRACT` gains `continuing` (moved out of `UNSUPPORTED_PARAMS`), and `page` on
  episodes if the source paginates. Piece 4 lives here too, beside `QUERY_CONTRACT`. It is generated,
  so a route missing from the OpenAPI document fails a test, the same way a route missing from
  `QUERY_CONTRACT` does today.

## Schema / Data Changes

**Parser version bumps** (cache invalidation; reversible, the cost is one refetch per row):
- `ANIME_PARSER_VERSION`, `ANIME_FULL_PARSER_VERSION` and `MANGA_PARSER_VERSION`, for relations.
- `CHARACTER_PARSER_VERSION` and `CHARACTER_FULL_PARSER_VERSION`.
- `EPISODES_PARSER_VERSION`.
- `PERSON_PARSER_VERSION` and `PERSON_FULL_PARSER_VERSION`.
- `REVIEW_PARSER_VERSION` and `TITLE_REVIEWS_PARSER_VERSION`.
- `ANIME_SEARCH_PARSER_VERSION` and `MANGA_SEARCH_PARSER_VERSION`.
- `SEASON_PARSER_VERSION`.
- Whichever detail parsers the window audit touches.

**Shape changes need a migration that deletes the affected rows** (pattern `0010`). The stale fallback
deliberately does not check `parser_version`, so without the delete an old-shape payload is served
whenever MAL is down. That applies to `alternateNames` (string → array), `birthday` (format) and
character `name` (format), and to anything else whose type changes rather than whose value changes.
The next migration number is `0013`.

**One-way for consumers:**
- The `name`, `alternateNames` and `birthday` format changes.
- The status-code changes: 404 → 200 on empty and past-end pages; 200 → 404 and 502 → 404 on missing
  entities.

Each one needs a `CHANGELOG.md` entry in the same commit, and an entry in `docs/routes.md` and in the
site's route grid. Adding fields and adding relation entries is not breaking.

No new D1 table is expected.

## Interfaces / APIs

| Method | Route / Entry point | Auth | Description |
|--------|---------------------|------|-------------|
| GET | `/v1/anime/:id`, `/full`, `/relations` | none | relations complete (tiles + table) |
| GET | `/v1/manga/:id`, `/full`, `/relations` | none | same |
| GET | `/v1/characters/:id`, `/full` | none | `nameKanji`, `favorites` and `about` on long pages; `nicknames` split out of `name` |
| GET | `/v1/anime/:id/episodes?page=` | none | filler and recap rows kept and flagged; pagination if the source has it |
| GET | `/v1/anime/:id/episodes/:episode` | none | 404 for an episode that does not exist |
| GET | `/v1/people/:id`, `/full` | none | `alternateNames[]`, ISO `birthday`, `about` without injected spaces |
| GET | `/v1/anime`, `/v1/manga`, `/v1/characters`, `/v1/people` (search) | none | 200 `[]` on no match and past the end; extra columns on anime and manga entries |
| GET | `/v1/top/*`, `/v1/reviews/*`, `/v1/recommendations/*` and every other paginated route | none | 200 `[]` past the end |
| GET | `/v1/reviews/*`, `/v1/anime\|manga/:id/reviews` | none | id, url, `isSpoiler`, `isPreliminary`, reactions |
| GET | `/v1/seasons/now`, `/upcoming`, `/:year/:season` | none | `continuing` per entry and as a parameter |
| GET | `/openapi.json` (new) | none | generated OpenAPI document |

## Scope

### In Scope
- [x] Relations read both the tiles and the `entries-table`, for anime and manga, on the detail, `full` and `relations` routes.
- [x] Character detail extracts `nameKanji`, `favorites` and `about` whatever the page size.
- [x] Episode list keeps Filler and Recap rows and exposes `filler` and `recap`.
- [x] `richText` stops injecting a space where an inline tag was.
- [x] Window audit: every fixed `slice(0, N)` in a detail parser is measured against the largest real page of its entity, and removed or justified.
- [x] Empty search and past-the-end page → 200 with `[]` and `hasNextPage: false`.
- [x] Nonexistent episode, character and club → 404.
- [x] Episode list pagination, if research confirms the source paginates.
- [x] Search entries carry the extra columns MAL's results page offers.
- [x] Reviews carry id, url, spoiler and preliminary flags, and reactions, where the page has them.
- [x] `alternateNames` as an array. *Changed in the build:* `birthday` stays MAL's text and a new `birthDate` carries the ISO date, because many birthdays have no year and an ISO field would have dropped them.
- [x] `nicknames` split out of the character `name`. *Not achieved:* one name format across `characters/*` and `top/characters` — the detail page carries the family-first form only for ranked characters.
- [x] `continuing` on season entries and as a query parameter.
- [x] A generated `/openapi.json`, with a test that fails when a `QUERY_CONTRACT` route is missing from it.
- [x] Migration `0013` deleting the rows whose shape changes.
- [x] `CHANGELOG.md`, `docs/routes.md` and the site route grid updated with each consumer-visible change.

### Out of Scope
- **A Jikan v4 response shape or a `/v4/` compatibility layer.** It is the biggest thing Tenrai does
  well, but a second public contract over every route is its own product decision. It needs its own pitch.
- **A pre-crawled catalogue, `/ids`, `/deleted` and `updated_at`.** They need mass scraping, which
  [[source-policy]] forbids.
- **`limit`, `max_score`, `genres_exclude`, `producers` and `sfw`.** Each is refused with a measured
  reason in `src/http/query-contract.ts`; not reopened without new evidence.
- **`pagination.total` outside the user lists.** MAL prints no total, and deriving one invents a number.
- **`order_by` on rank, popularity, favorites, scored_by or title.** MAL's search form has no such
  sort, and `title` was measured as ignored.
- **The full 36-field object in search results.** It would cost one MAL fetch per entry. Only what the
  results page itself carries is in scope.
- **Cache-miss latency** (p95 2.2 s against Tenrai's 361 ms). It is inherent to fetching on demand;
  pre-warming popular entities would be a separate pitch.
- **News, articles and stacks routes, `top/reviews` (already declined), server keys and rate-limit tiers.**
- **Producer search completeness** (1 result for "toei" against Tenrai's 6), until research finds a
  public page that lists every producer.

## Research Needed

All answered in [[2026-10-11-tenrai-gap-probes/research]]: the MAL questions by measurement at the
edge, and OpenAPI generation by prototype (`@asteasolutions/zod-to-openapi` 7.3.4, a committed
`site/openapi.json` checked by a test). The `continuing` and `preliminary` defaults and the character
`name` format are decisions; the note lays out the facts each side needs. The same research found two defects this pitch did not list: the anime synopsis is cut by
the 90 KB window (null for One Piece, Detective Conan and Naruto Shippuuden), and manga `type=novel`
is mapped to MAL's Light Novel.

- [x] Where every field sits, in bytes, on the largest real page of each entity (character, person, producer, club, anime, manga, profile), fetched with `wrangler dev --remote` so the HTML is what Cloudflare's network receives.
- [x] Whether `/anime/:id/episodes?offset=N` paginates, at what page size, and what page ceiling to allow (One Piece needs about 12 pages).
- [x] Which extra columns MAL's search results page can show (`c[]=` parameters), and whether they arrive intact at the edge.
- [x] Where the preliminary and spoiler tags, reaction counts and review id sit in the HTML, on both the global and the per-title review pages.
- [x] Where MAL exposes the canonical character name (`Monkey D., Luffy`) apart from the `<h1>`, and why `top/characters` already returns it.
- [x] The default for `continuing`. Jikan's semantics (excluded unless the flag is passed) would drop `seasons/now` from 163 to about 118 entries, a breaking change. The alternative is to keep everything and add the flag per entry.
- [x] How to tell MAL's 404 for "zero results" and "page past the end" from a real upstream failure, without a second fetch.
- [x] What to answer for a query under 3 characters: a 400 that explains MAL's minimum, or a different public lookup. "86" is a real title.
- [x] Whether MAL's search type filter offers `cm`, `pv` and `tv_special`, which Tenrai accepts.
- [x] Whether any public MAL page lists every producer: Toei Video (id 141) exists but is not in `/anime/producer`.
- [x] OpenAPI generation:
  - do the zod schemas in `src/parsers/` cover the full response shapes, including the `{ data, meta }` envelope?
  - which generator works with zod `^3.24.3` and the Workers bundle?
  - should the document be generated at build time, or committed as an artefact?

## Testing Strategy

- **Parsers.** Each fix gets a byte-for-byte excerpt of the real page as its fixture: One Piece's
  episode page with Filler rows, Luffy's page past 110 KB, One Piece's relations (tiles plus table),
  Berserk's Spin-Off and Other, Seki's `about`. Each test is run with the fix reverted and must go red.
  A synthetic fixture is what let all four defects pass the suite.
- **Services.** Status mapping is tested with fakes: an empty result, a page past the end, a missing
  episode, a missing character, and a real upstream 404, which must stay a 404 or 502.
- **Contract.** The `QUERY_CONTRACT` test gains `continuing`. A new test enumerates `app.routes`
  against the OpenAPI paths.
- **Migration.** Old-shape rows are gone after `0013`, and rows that did not change shape are untouched.
- **Production, after each deploy.** Re-run the 2026-10-11 paired sweep (73 variations plus 39
  probes) and the live-MAL comparison, and record the numbers in `docs/results/` next to the baseline
  below.

## Success Criteria

Measured on the branch with `wrangler dev --local` against the live pages; the numbers are in
[[2026-10-11-tenrai-gap-fixes]]. Not deployed yet, so "in production" below means "on the local Worker".
The window audit table lives in the research note rather than in `docs/results/`.
- [x] `anime/21/relations` returns as many entries as the live MAL page (94 at the baseline), and `manga/2/relations` returns 9.
- [x] `characters/40`, `417` and `62` return non-null `nameKanji`, `favorites` and `about`, with `favorites` within 0.5% of MAL.
- [x] `anime/21/episodes` page 1 returns 100 of 100, with `filler` matching MAL's markers row by row.
- [x] The window audit table is in `docs/results/`, with no window cutting a field on the largest page measured.
- [x] `anime?q=zzqqxxyyvvkk` and `top/anime?page=700` answer 200 with `[]`; `anime/21/episodes/99999` and `characters/99999999` answer 404.
- [x] Every new field is checked field by field against the real page on a recorded sample, not only through the fixture.
- [x] `/openapi.json` lists every `QUERY_CONTRACT` route, and a test fails when one is missing.
- [x] The re-run sweep still has zero non-200 responses on the 73 variations, and no regression on the 50+ routes whose counts already matched Tenrai's (characters 1,481, staff 543, voices 544, genres 78/79, schedules 121).

Related: [[jikan-v4-route-validation]], [[routes]], [[2026-08-27-route-audit-and-hardening]].
