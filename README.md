# jikan-edge

**A [Jikan](https://github.com/jikan-me/jikan)-parity anime & manga REST API running entirely on Cloudflare Workers.**

Public MyAnimeList data — anime, manga, characters, people, producers, clubs, seasons, schedules, reviews, recommendations, user profiles and more — served from the edge with D1-backed caching, stale fallback, and per-route contract tests.

```
Base URL: https://jikan-edge.lucas-hdo.workers.dev
```

## Quick start

```bash
# Anime detail
curl https://jikan-edge.lucas-hdo.workers.dev/v1/anime/1

# Search with server-side filters
curl "https://jikan-edge.lucas-hdo.workers.dev/v1/anime?q=naruto&type=movie"
curl "https://jikan-edge.lucas-hdo.workers.dev/v1/anime?genres=1&score=9&order_by=score"

# Current season, weekly schedule, top rankings
curl https://jikan-edge.lucas-hdo.workers.dev/v1/seasons/now
curl "https://jikan-edge.lucas-hdo.workers.dev/v1/schedules?filter=monday"
curl "https://jikan-edge.lucas-hdo.workers.dev/v1/top/anime?page=1"

# User profiles
curl https://jikan-edge.lucas-hdo.workers.dev/v1/users/USERNAME/full
```

Every response is wrapped in `{ "data": ..., "meta": { cached, stale, refreshFailed, fetchedAt } }`. Errors return `{ "error": { code, message, requestId } }`.

## Route surface

96 GET routes under `/v1`, mirroring the Jikan v4 functional surface:

| Group | Routes |
| --- | --- |
| Anime | search (with `type`/`status`/`rating`/`score`/`genres`/`order_by` filters), detail, full, characters, staff, episodes, episode detail, videos, pictures, statistics, news, forum, relations, themes, external, streaming, recommendations, reviews, moreinfo, userupdates |
| Manga | search (with filters), detail, full, characters, pictures, statistics, news, forum, relations, external, recommendations, reviews, moreinfo, userupdates |
| Characters / People | detail, full, anime, manga, voices, pictures, news (people), search, top |
| Users | profile, full, about, statistics, favorites, updates, friends, clubs, reviews, recommendations, animelist, mangalist, search |
| Seasons | now, by year/season, upcoming, archive, weekly schedule (`?filter=monday..sunday\|other\|unknown`) |
| Clubs / Producers / Magazines | detail, members, staff, relations (clubs); directory + detail + full + external (producers); directory with `?q=` (magazines) |
| Watch / Reviews / Recommendations | recent + popular episodes/promos; paginated global reviews & recommendations |
| Random | anime, manga, characters, people, users |

The full route table with source pages, cache TTLs and per-route notes lives in [`docs/routes.md`](docs/routes.md).

## CORS

Fully open (`Access-Control-Allow-Origin: *`) — call the API directly from any browser frontend. Abuse control is handled by the rate limiter, not by origin restrictions.

## Rate limits

Two per-IP windows, enforced globally across all routes (mirroring Jikan's own policy):

- **30 requests / 10 seconds** (burst)
- **60 requests / minute** (sustained)

Exceeding either returns `429` with a `Retry-After` header.

## Caching

Fresh data is served straight from D1 without touching MyAnimeList. Cache misses fetch the public HTML page once, parse it, and persist the normalized result (TTL: 6 h for most resources, 2 h for user lists). If a refresh fails and a stale copy exists, the API answers `200` with `meta.stale: true` instead of erroring.

## Honest differences from Jikan

Responses follow the **Jikan v4 shape** — field names, entity refs, pagination and error format — so migrating means swapping the base URL. What differs is coverage, not schema: some Jikan routes have no public MyAnimeList page behind them, and some fields MyAnimeList never exposes come back `null`. Both lists are in [`docs/api.md`](docs/api.md) and below.

### Routes we can't serve (and why)

Each of these was investigated against the real MyAnimeList pages, with the evidence recorded in [`docs/routes.md`](docs/routes.md):

| Jikan route | Status here | Why |
| --- | --- | --- |
| `GET /genres/anime`, `GET /genres/manga` | Returns `500` | MAL serves a truncated genre sidebar (~12 of 40+/300+ entries) specifically to requests from Cloudflare's network. We refuse to cache incomplete data as if it were complete. |
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

## Development

```bash
npm install
npm run db:migrate:local
npm run dev:local     # local simulator
npm test              # unit tests
npm run test:integration
npm run benchmark     # parser p95 smoke tests
```

Architecture, source policy and local-dev details: [`docs/`](docs/README.md).

## Landing site

The public landing page (jikan.moe-style, with a live request demo) lives in [`site/`](site/index.html) and is served by the same Worker via Cloudflare static assets: `/` serves the site, `/v1/*` and `/health` fall through to the API. No build step — it's a single static HTML file deployed together with `wrangler deploy`.

## Disclaimer

Not affiliated with MyAnimeList or Jikan. All data is collected from publicly accessible MyAnimeList pages, cached aggressively, and rate-limited to keep upstream load minimal. If you are MyAnimeList and have concerns, please open an issue.

## License

[MIT](LICENSE)
