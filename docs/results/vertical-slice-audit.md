# Technical audit of the vertical slice — jikan-edge

Date: 2026-07-19. Scope: local code, remote D1, the R2 binding, the Wrangler configuration and the published Worker. No routes were added.

## Objective result

**Not ready to integrate into WeebProfile in production.** The basic flow works, but it lacks integration tests for cache/leases, abuse protection and instrumentation, and list collection still depends on a single HTML document and a fragile regex parser. It is fit only for controlled continued development.

## Confirmed routes and flow

| Route | Upstream/fetches | Parser | D1 read/write | hit/miss/stale and failure |
| --- | --- | --- | --- | --- |
| `/health` | none | none | none | 200 whenever the Worker answers |
| `/v1/users/:username` | `/profile/:username`, 1 on a miss | `parseUserProfile`; statistics too | reads `cache_entries`,`users`; writes `users`,`user_statistics`,`cache_entries`,`refresh_leases` | a fresh hit is a cached 200; a miss refreshes; stale returns 200 with `stale:true`; with no cache and a failure it returns 404/403/429/502/503/504 |
| `/statistics` | delegates to the profile; 0 on a hit, 1 on a miss | `parseUserStatistics` | the same, then reads `user_statistics` | the same rules as the profile |
| `/animelist` | `/animelist/:username`, 1 on a miss | `parseUserAnimeList` | reads `cache_entries`,`user_media_list_entries`; writes the list, cache and lease | a hit paginates over D1; stale preserves the list; with no cache it fails as above |
| `/mangalist` | `/mangalist/:username`, 1 on a miss | `parseUserMangaList` | the same for manga | the same |

TTLs confirmed in `wrangler.jsonc`: profile/statistics 21,600 s; lists 7,200 s. A suspicious response is rejected by the source client before persistence. The review also fixed the case of repeated IDs / an invalid Zod item in the parser: it now throws `ParserError`, and the existing stale data is preserved.

## Cache, leases and lists

- **Fresh cache, upstream available or unavailable:** confirmed by code flow; it does not call upstream.
- **Stale, upstream available:** partial; the code does a synchronous refresh and replaces the snapshot if the parser accepts it.
- **Stale, upstream unavailable and suspicious HTML:** confirmed by flow; it returns stale and never reaches `replaceList`/`saveProfile`.
- **No cache, upstream unavailable:** confirmed by flow; the error is mapped and nothing is written to cache.
- **Leases:** acquisition is an `INSERT ... ON CONFLICT ... WHERE expires_at < now`; it is a single D1 statement and therefore atomic per key. `release` is conditioned on the owner. Leases for different resources do not conflict. There is no concurrent/abandonment integration test; state: **not tested**.
- **Lists:** `D1Database.batch` is transactional; the delete and the inserts roll back together if a statement fails. However there is no upstream pagination, no size/count limit, no markup-change detection beyond the extraction itself, and no test with a large real list. State: **partial**. The new incomplete-snapshot block prevents silent corruption from duplicates or invalid items that happen to match the selector.

## Statistics and benchmark

`/statistics` does not query a page of its own and does not derive from the lists: it extracts Anime Stats and Manga Stats from the same profile page. The earlier run against `AMayacrab` returned anime completed 288 and manga reading 51 / plan-to-read 10; there is no persisted corpus and no second independent collection to compare against, so the required comparison is **not tested**.

The earlier figure of approximately 0.12 ms measures only 100 in-memory invocations of `parseUserProfile` over `tests/fixtures/users/profile-valid.html`, after a `readFileSync` outside the loop. It does not include the fetch, `classifyHtml` validation, D1, the Worker, serialization or an explicit warmup; it is not a production p95. There is no corpus of varied sizes and no p99/mean per parser: **not implemented**.

## R2, security and observability

`SNAPSHOTS_BUCKET` is configured but is not referenced in `src/`: no object, retention, cleanup or cost exists. State: **not implemented**; the binding is dispensable until there is a privacy/retention design.

SSRF: **confirmed** — `MalClient` accepts only HTTPS and the exact hostname `myanimelist.net`; URLs are internal and do not come from the client. There is an 8 s timeout and a 2 MiB ceiling. D1 queries are parameterized; stack traces are not returned. An ASCII-only username blocks Unicode/percent-encoded input. Partial: redirects are followed without revalidating the final destination, and there is no retry/backoff, rate limiting, explicit CORS or effective metric (`logMetric` is imported but never called). The User-Agent still contains a placeholder URL and must point at a real contact before production.

## Published Worker and configuration

The project/Worker was renamed and published as `jikan-edge`: `https://jikan-edge.lucas-hdo.workers.dev` (version `b77586ca-7124-48e4-a8eb-6124b291a46a`). New remote D1: `jikan-edge` (`71f8a596-7855-47a5-906c-9a1cf46e12ee`) with the 9 domain tables plus internal tables; new R2: `jikan-edge-snapshots`. The old `jikanv2` resources were preserved, not deleted.

Matrix executed after the deploy: `/health` 200; `AMayacrab` profile 200 (the first miss); percent-encoded username `a%2Fb` 400; `animelist?limit=999` 200 with the limit clamped to 300; manga list 200/cached. There were intermittent Cloudflare `1042`/404 responses when running consecutive calls very quickly, including on `animelist?limit=3`; the same route answered again right afterwards. That is not handled by the Worker and reinforces the **not ready** state. `curl -i https://jikan-edge.lucas-hdo.workers.dev/health` and `curl -i "https://jikan-edge.lucas-hdo.workers.dev/v1/users/AMayacrab/animelist?limit=3"` are reproducible.

## Final table

| Area | State | Evidence | Risk | Fix |
| ---- | ------ | --------- | ----- | -------- |
| Basic routes | confirmed | `src/app.ts`, the service and the deploy | low | keep the contracts tested |
| Source/SSRF | partial | allowlist/timeout/limit in the client | medium | validate the redirect destination; a real contact in the UA |
| Stale cache | partial | `withCache` and validation | medium | integration tests with D1 and a fake fetch |
| Leases | partial | atomic upsert in D1 | medium | concurrent tests and telemetry |
| List integrity | partial | transactional batch; parser fix | high | a structured parser, a limit and a real corpus |
| Upstream pagination | not implemented | one fetch per list | high | define the source/pagination before very large lists |
| Statistics | partial | the profile parser | medium | automated comparison and real fixtures |
| Benchmark | incorrect | a 100-loop smoke test | medium | a corpus and complete metrics |
| R2 | not implemented | an unused binding | low | remove the binding or design retention |
| Rate limit/CORS/metrics | not implemented | the code | high | implement before public exposure |
| Integration tests | not implemented | only 9 unit tests | high | D1/leases/cache and an HTTP matrix |
