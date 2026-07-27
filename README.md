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

This project aims for **functional parity, not schema-identical cloning**. Field names are camelCase and response shapes are documented per route. A few Jikan routes are deliberately not served, each with recorded evidence in [`docs/routes.md`](docs/routes.md):

- `genres/anime` & `genres/manga` — MyAnimeList serves a truncated genre sidebar to requests originating from Cloudflare's network.
- Club search — `clubs.php?q=` performs no server-side filtering at all.
- `top/reviews` — MAL has no real review ranking mechanism to source it from.
- User history — the MAL page renders empty without login (`userupdates` covers the public equivalent).
- `random/*` draws only from locally cached entries rather than the full MAL database (no mass ID scanning, by policy).

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

## Disclaimer

Not affiliated with MyAnimeList or Jikan. All data is collected from publicly accessible MyAnimeList pages, cached aggressively, and rate-limited to keep upstream load minimal. If you are MyAnimeList and have concerns, please open an issue.

## License

[MIT](LICENSE)
