<p align="center">
  <img src=".github/banner.png" alt="jikan-edge" width="100%" />
</p>

# jikan-edge

**A [Jikan](https://github.com/jikan-me/jikan)-parity anime & manga REST API running entirely on Cloudflare Workers.**

[![API status](https://img.shields.io/website?url=https%3A%2F%2Fjikan.lucashdo.com%2Fhealth&label=api&up_message=online&down_message=down)](https://jikan.lucashdo.com/health)
[![Routes](https://img.shields.io/badge/routes-97%20under%20%2Fv1-blue)](docs/routes.md)
[![Runtime](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f38020)](https://workers.cloudflare.com/)
[![No auth](https://img.shields.io/badge/auth-none%20required-brightgreen)](#quick-start)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Public MyAnimeList data — anime, manga, characters, people, producers, clubs, seasons, schedules, reviews, recommendations, user profiles and more — served from the edge with D1-backed caching, stale fallback, and per-route contract tests.

```
Base URL: https://jikan.lucashdo.com
```

No API key, no signup, no `Authorization` header. The previous hostname, `https://jikan-edge.lucas-hdo.workers.dev`, still serves the same Worker and is not scheduled for removal — existing integrations keep working without a change.

**Contents** — [Quick start](#quick-start) · [Route surface](#route-surface) · [Using the API](#using-the-api) · [Rate limits](#rate-limits) · [Caching](#caching) · [Honest differences from Jikan](#honest-differences-from-jikan) · [Self-hosting](#self-hosting) · [Development](#development)

## Quick start

```bash
# Anime detail
curl https://jikan.lucashdo.com/v1/anime/1

# Search with server-side filters
curl "https://jikan.lucashdo.com/v1/anime?q=naruto&type=movie"
curl "https://jikan.lucashdo.com/v1/anime?genres=1&score=9&order_by=score"

# Current season, weekly schedule, top rankings
curl https://jikan.lucashdo.com/v1/seasons/now
curl "https://jikan.lucashdo.com/v1/schedules?filter=monday"
curl "https://jikan.lucashdo.com/v1/top/anime?page=1"

# User profiles
curl https://jikan.lucashdo.com/v1/users/USERNAME/full
```

`GET /v1/anime/1`, trimmed to one field per shape:

```json
{
  "data": {
    "malId": 1,
    "url": "https://myanimelist.net/anime/1/Cowboy_Bebop",
    "title": "Cowboy Bebop",
    "titleEnglish": "Cowboy Bebop",
    "type": "TV",
    "episodes": 26,
    "status": "Finished Airing",
    "aired": { "from": "1998-04-03", "to": "1999-04-24", "string": "Apr 3, 1998 to Apr 24, 1999" },
    "score": 8.75,
    "scoredBy": 1073406,
    "rank": 49,
    "members": 2081325,
    "imageUrl": "https://cdn.myanimelist.net/images/anime/4/19644.jpg",
    "images": {
      "small": "https://cdn.myanimelist.net/images/anime/4/19644t.jpg",
      "medium": "https://cdn.myanimelist.net/images/anime/4/19644.jpg",
      "large": "https://cdn.myanimelist.net/images/anime/4/19644l.jpg"
    },
    "genres": [{ "malId": 1, "name": "Action", "url": "https://myanimelist.net/anime/genre/1/Action" }],
    "studios": [{ "malId": 14, "name": "Sunrise", "url": "https://myanimelist.net/anime/producer/14/Sunrise" }]
  },
  "meta": { "cached": true, "stale": false, "refreshFailed": false, "fetchedAt": "2026-08-26T23:17:42.708Z" }
}
```

The full key set for this route also includes `titleJapanese`, `titleSynonyms`, `trailer`, `synopsis`, `background`, `airing`, `season`, `year`, `broadcast`, `producers`, `licensors`, `themes`, `demographics`, `duration`, `rating`, `popularity`, `favorites`, `source`, `relations`, `externalLinks` and `streaming`.

## Route surface

97 GET routes under `/v1` (98 counting `/health`), covering **96 of the 100 endpoints** in Jikan
v4's published OpenAPI spec, plus one Jikan does not have (`/v1/people/{id}/news`):

| Group | Routes |
| --- | --- |
| Anime | search (server-side filters — see [Search filters](#search-filters)), detail, full, characters, staff, episodes, episode detail, videos, pictures, statistics, news, forum, relations, themes, external, streaming, recommendations, reviews, moreinfo, userupdates, genre taxonomy (`?filter=genres\|explicit_genres\|themes\|demographics`) |
| Manga | search (same filters, `magazines` instead of `rating`), detail, full, characters, pictures, statistics, news, forum, relations, external, recommendations, reviews, moreinfo, userupdates, genre taxonomy |
| Characters / People | detail, full, anime, manga, voices, pictures, news (people), search, top |
| Users | profile, full, about, statistics, favorites, updates, friends, clubs, reviews, recommendations, animelist, mangalist, search |
| Seasons | now, by year/season, upcoming, archive, weekly schedule (`?filter=monday..sunday\|other\|unknown`) |
| Clubs / Producers / Magazines | detail, members, staff, relations (clubs); directory + detail + full + external (producers); directory with `?q=` (magazines) |
| Watch / Reviews / Recommendations | recent + popular episodes/promos; paginated global reviews & recommendations |
| Random | anime, manga, characters, people, users |

The full route table with source pages, cache TTLs and per-route notes lives in [`docs/routes.md`](docs/routes.md).

## Using the API

### Response envelope

Every successful response is `{ data, meta }`:

| `meta` field | Meaning |
| --- | --- |
| `cached` | Served from D1 without touching MyAnimeList |
| `stale` | Past its TTL and the refresh did not replace it — `data` is the last good copy |
| `refreshFailed` | A refresh was attempted and failed. Paired with `stale: true`, this is the API answering while MyAnimeList is unreachable |
| `fetchedAt` | ISO timestamp of when `data` was pulled from MyAnimeList |
| `pagination` | Present on paginated routes only (below) |

Errors are `{ "error": { code, message, requestId } }`. Quote the `requestId` when reporting one — it is also returned in the `X-Request-Id` header and written to the Worker's logs.

### Pagination

```json
"pagination": { "page": 2, "limit": 50, "count": 50, "total": null, "hasNextPage": true }
```

- `page` accepts **1–1000**. Anything else is `400 INVALID_PAGE` rather than being silently clamped to 1.
- `limit` here is the **upstream page size, not a knob you set** — it is whatever MyAnimeList serves for that listing: 50 (search, top, clubs, global reviews), 100 (recommendations), 36 (club members), 24 (user search), 20 (per-title reviews).
- `total` is `null` on every route except the two user list routes. MyAnimeList prints no total anywhere, and deriving one from `lastPage × perPage` would be a fabricated number. `hasNextPage` is derived from page fullness instead.
- `limit` is accepted **as input** only on `/v1/users/{user}/animelist` and `/mangalist` (default 100, max 300), which paginate over D1 rather than over an upstream page.

### Search filters

`GET /v1/anime` and `GET /v1/manga` filter server-side on MyAnimeList. Every value below was verified
against live responses by comparing result ids against the unfiltered call — a `200` does not prove a
filter was honoured, and MyAnimeList silently ignores parameters it does not recognize.

| Parameter | Accepted values | Notes |
| --- | --- | --- |
| `q` | 1–64 characters | Optional — a filters-only search with no `q` is valid |
| `page` | 1–1000 | 50 results per page |
| `type` | anime: `tv` `ova` `movie` `special` `ona` `music` · manga: `manga` `novel` `lightnovel` `oneshot` `doujin` `manhwa` `manhua` | |
| `status` | `airing`/`publishing`, `complete`/`finished`, `upcoming` | |
| `rating` | `g` `pg` `pg13` `r17` `r` `rx` | Anime only |
| `score` / `min_score` | integer 1–10 | The same knob under two names — MyAnimeList's dropdown is a minimum. Passing both with different values is refused, not silently resolved |
| `genres` | comma-separated genre ids | **ANDed**, not ORed: an entry must carry every id given. Ids come from `/v1/genres/anime` and `/v1/genres/manga` |
| `magazines` | a single magazine id | Manga only. Ids from `/v1/magazines` |
| `start_date` / `end_date` | `YYYY-MM-DD` | An entry MyAnimeList has no date for is *included* by either bound rather than filtered out |
| `letter` | a single letter | |
| `order_by` | `start_date` `score` `episodes`/`volumes` `end_date` `type` `members` `rating` `mal_id` | `title` is deliberately absent: MyAnimeList returns the same non-alphabetical order for both directions, so offering it would be an ordering that does not order |
| `sort` | `asc`, `desc` | Requires `order_by` |

### Unknown parameters are refused, not ignored

A parameter a route does not declare is a `400`, never a silent no-op. This API used to answer `200`
to `?limit=5`, `?sfw=1` and `?sort=asc` while honouring none of them — the worst kind of divergence,
because the caller has no way to tell it did nothing.

Two codes, and the distinction is the point for anyone porting from Jikan:

```jsonc
// GET /v1/anime/1?sort_by=score
{ "error": { "code": "UNKNOWN_PARAMETER",
             "message": "\"sort_by\" is not a parameter of this route, which takes none." } }

// GET /v1/anime?q=naruto&sfw=true
{ "error": { "code": "UNSUPPORTED_PARAMETER",
             "message": "\"sfw\" is not supported on this route. Not supported: MyAnimeList has no server-side safe-for-work switch, and approximating one by excluding a few genre ids would be a guess wearing the name of a guarantee. …" } }
```

`UNKNOWN_PARAMETER` means the name exists nowhere — likely a typo. `UNSUPPORTED_PARAMETER` means it
exists in Jikan v4 and this API does not honour it; the message says why. Jikan parameters in that
second group: `limit` (outside the user lists), `sfw`, `max_score`, `producers`, `genres_exclude`,
`unapproved`, `preliminary`, `spoilers`, `kids`, `continuing`.

### Response headers

| Header | Value |
| --- | --- |
| `X-Cache-Status` | `hit`, `miss`, `stale`, `local` (random routes, drawn from D1), `rate_limited`, `unknown` |
| `X-Request-Id` | Matches `error.requestId`; use it when reporting a problem |
| `X-Worker-Version` | Deployed Worker build |
| `Retry-After` | On `429` only — seconds until the exceeded window resets |
| `Access-Control-Allow-Origin` | `*` — see [CORS](#cors) |

### Error codes

| HTTP | Codes | When |
| --- | --- | --- |
| `400` | `UNKNOWN_PARAMETER`, `UNSUPPORTED_PARAMETER`, `INVALID_PAGE`, `INVALID_LIMIT`, `INVALID_QUERY`, `INVALID_FILTER`, `INVALID_ANIME_ID` / `INVALID_MANGA_ID` / `INVALID_CHARACTER_ID` / `INVALID_PERSON_ID` / `INVALID_PRODUCER_ID` / `INVALID_CLUB_ID` / `INVALID_USERNAME`, `INVALID_EPISODE`, `INVALID_SEASON`, `INVALID_SEASON_YEAR` | The request is malformed. Nothing was fetched |
| `403` | `PRIVATE_PROFILE` | The MyAnimeList profile or list is not public |
| `404` | `NOT_FOUND`, `NO_LOCAL_ENTRIES` | No such entry upstream; or `/v1/random/*` with an empty local catalog |
| `429` | `RATE_LIMITED`, `UPSTREAM_RATE_LIMITED` | You hit this API's limiter; or MyAnimeList rate-limited the Worker |
| `500` | `INTERNAL_ERROR` | A bug. The `requestId` is in the logs |
| `501` | `LIST_TOO_LARGE` | A user list exceeds the 6,000 entries one refresh reads. Refused rather than truncated silently |
| `502` | `UPSTREAM_SUSPICIOUS` | The page came back, but did not look like the page it should be. Never overwrites good cached data |
| `503` | `UPSTREAM_UNAVAILABLE`, `REFRESH_IN_PROGRESS`, `CACHE_WRITE_FAILED`, `DATABASE_NOT_CONFIGURED`, `DATABASE_NOT_MIGRATED` | Transient upstream failure, a concurrent refresh holding the lock, or (self-hosters) a D1 binding that is missing or un-migrated |
| `504` | `UPSTREAM_TIMEOUT` | MyAnimeList did not answer within the source timeout |

A `4xx`/`5xx` only reaches you when there is **no** usable cached copy. If one exists, you get `200` with `meta.stale: true` instead.

### CORS

Fully open (`Access-Control-Allow-Origin: *`) — call the API directly from any browser frontend. Abuse control is handled by the rate limiter, not by origin restrictions.

## Rate limits

Two per-IP windows, enforced globally across all routes (mirroring Jikan's own policy):

- **30 requests / 10 seconds** (burst)
- **60 requests / minute** (sustained)

Exceeding either returns `429` with a `Retry-After` header. The key is the client IP alone, not IP-plus-route — a per-route key would let one client multiply its budget by the number of routes.

## Caching

Fresh data is served straight from D1 without touching MyAnimeList. Cache misses fetch the public HTML page once, parse it, and persist the normalized result (TTL: 6 h for most resources, 2 h for user lists). Concurrent misses for the same resource are serialized by a lease so only one of them reaches upstream.

If a refresh fails and a stale copy exists, the API answers `200` with `meta.stale: true` instead of erroring. That fallback is the property this project is built around, and it has been measured rather than assumed: during one upstream incident, 81 of Jikan's 94 routes were answering `504 "Jikan failed to connect to MyAnimeList"` while these routes kept serving.

## Honest differences from Jikan

This project aims for **functional parity, not schema-identical cloning**.

### Not a drop-in replacement

Pointing a Jikan client at this base URL will not work. That is a deliberate choice — camelCase and
a flat envelope suit the JS/TS consumers this API has — but it is a choice, and it deserves to be
stated rather than discovered:

| | jikan-edge | Jikan v4 |
| --- | --- | --- |
| Envelope | `{ data, meta }` | `{ data, pagination }` |
| Field names | camelCase — `malId`, `titleEnglish` | snake_case — `mal_id`, `title_english` |
| Errors | `{ error: { code, message, requestId } }` | `{ status, type, message, error }` |
| Images | `imageUrl` + `images.{small,medium,large}` | `images.{jpg,webp}.{image,small_image,large_image}_url` |
| Dates | `{ from, to, string }` | `{ from, to, prop: { from: {…}, to: {…} }, string }` |
| Pagination | `meta.pagination` | top-level `pagination` |
| Items per page | 50 on top lists, a whole season in one response | 25, with a hard `limit=25` ceiling |
| Cache state | `meta.cached` / `stale` / `fetchedAt` + `X-Cache-Status` | not exposed |

Renaming fields is not enough to port a client: the shapes above differ too, and a mechanical
`mal_id → malId` leaves `undefined` in silence. [`docs/api.md`](docs/api.md) lists the shape changes
one by one.

Two things this API has that Jikan does not: **user anime and manga lists**, which Jikan deprecated
in May 2022 and gates behind a config flag, and `GET /v1/people/{id}/news`.

### Routes we can't serve (and why)

Each of these was investigated against the real MyAnimeList pages, with the evidence recorded in [`docs/routes.md`](docs/routes.md):

| Jikan route | Status here | Why |
| --- | --- | --- |
| `GET /clubs?q=` (club search) | `q` is ignored (index only) | `clubs.php?q=` performs **no** server-side filtering — any query returns the same list. MAL's real club search is an internal JS/AJAX endpoint, which this project's source policy forbids. |
| `GET /top/reviews` | Not served | MAL has no review ranking mechanism (no sort-by-helpful, day-only date granularity). Serving it would be `reviews/anime` wearing a costume. |
| `GET /users/{user}/history` | Not served | The MAL history page renders empty without login. `GET /v1/users/{user}/userupdates` covers the public equivalent from the profile page. |
| `GET /users/{user}/external` | Not served | The MAL profile exposes no structured external links to source it from. |
| `GET /users/userbyid/{id}` | Not served | Depends on a Jikan-internal ID-to-username mechanism with no public MAL page behind it. |
| Per-episode forum (`forum?filter=episode`) | Not served | No dedicated public page per episode discussion worth scraping reliably. |

### Known limitations on served routes

- `GET /anime/{id}/episodes` fetches only MAL's first page — very long series return a truncated list (upstream pagination format unconfirmed).
- `GET /anime/{id}/streaming` may return `[]` in production even when data exists: streaming availability is geo-dependent and MAL resolves Cloudflare's network to a different region.
- `GET /random/*` draws only from locally cached entries rather than the full MAL database (no mass ID scanning, by policy). Empty local catalog → `404 NO_LOCAL_ENTRIES`.
- Text-query searches with zero real matches mirror MAL's own fallback behavior (popular unrelated titles) instead of returning an empty list.

## Self-hosting

Your own instance on your own Cloudflare account. No API keys and no upstream credentials — the only
resource it needs is a D1 database, which the setup script creates and migrates for you.

```bash
git clone https://github.com/LucasHenriqueDiniz/jikan-edge.git && cd jikan-edge
npm install
npx wrangler login
npm run setup            # creates D1, writes its id into wrangler.jsonc, applies the migrations
npx wrangler deploy

curl https://<your-worker>.<your-subdomain>.workers.dev/health   # checks.database must read "ok"
```

One caveat worth knowing before you pick a plan: Workers Free caps CPU at 10 ms per invocation, and
this API's heaviest cache misses measure p95 27 ms / max 48 ms — those routes return `Error 1102` on
Free. The full guide — manual setup, troubleshooting, plan limits, and what to change before sending
real traffic to MyAnimeList — is in [`docs/self-hosting.md`](docs/self-hosting.md).

## Development

```bash
npm install
npm run db:migrate:local
npm run dev:local     # local simulator; `npm run dev` runs against the real network
npm test              # unit tests
npm run test:integration
npm run typecheck
npm run benchmark     # parser p95 smoke tests
```

Use `npm run dev` (`wrangler dev --remote`) for anything that depends on **how MyAnimeList responds
to Cloudflare's network** — `--local` egresses from your machine and will not reproduce it.

Every route's accepted query parameters live in [`src/http/query-contract.ts`](src/http/query-contract.ts), and a test enumerates the router to fail if a route is missing from it. Architecture, source policy and local-dev details: [`docs/`](docs/README.md). Changes that affect consumers are listed in [`CHANGELOG.md`](CHANGELOG.md).

## Landing site

The public landing page (jikan.moe-style, with a live request demo) lives in [`site/`](site/index.html) and is served by the same Worker via Cloudflare static assets: `/` serves the site, `/v1/*` and `/health` fall through to the API. No build step — it's a single static HTML file deployed together with `wrangler deploy`.

## Disclaimer

Not affiliated with MyAnimeList or Jikan. All data is collected from publicly accessible MyAnimeList pages, cached aggressively, and rate-limited to keep upstream load minimal. If you are MyAnimeList and have concerns, please open an issue.

## License

[MIT](LICENSE)
