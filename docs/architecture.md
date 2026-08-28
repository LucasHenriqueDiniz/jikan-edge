# Vertical slice architecture

Flow: public MAL HTML → `MalClient` → response validation → pure parser → normalized models → D1/cache → Hono → WeebProfile.

`UserService` (profile, statistics, favorites, updates, lists) and `AnimeService` (detail, genres, top, current season) coordinate the refresh. Both delegate cache/stale/lease orchestration to `withCache` in `src/services/cacheable.ts` — extracted from what used to be a private method belonging to `UserService` alone — so the logic is not duplicated for each new entity. `ServiceError`, `ServiceResponse<T>` and `sourceError()` (the `SourceResult.kind` → HTTP code/status mapping) also live in that shared module.

D1 holds normalized entities and `cache_entries`; `refresh_leases` keeps an expiring lease per resource to avoid concurrent refreshes. If stale data exists and the source fails, the response is still a 200 with `meta.stale=true` and `meta.refreshFailed=true`. Entities with a single record per key (favorites, updates, anime detail) use a dedicated table with a `payload_json` column; list-shaped resources with no entity of their own (genres, top anime, current season) use the generic `catalog_lists` table, keyed by `resource_key` (e.g. `catalog:top:anime:page:1`).

There are no Durable Objects. **There is no R2 either**: the `SNAPSHOTS_BUCKET` binding existed for problematic snapshots, was never referenced in `src/` (a finding already recorded in [`results/vertical-slice-audit.md`](results/vertical-slice-audit.md)) and was removed on 2026-07-30 — keeping it forced anyone cloning the project to create a bucket for nothing. D1 is the only storage. The parser neither fetches nor touches the database.
