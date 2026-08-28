# Initial viability

Date: 2026-07-19.

> **Later correction (2026-08-27).** The "Published environment" block below is out of date in three
> ways, and one of them describes something that no longer exists:
>
> - The Worker is `jikan-edge`, served at `https://jikan.lucashdo.com` (and
>   `https://jikan-edge.lucas-hdo.workers.dev`), not `jikanv2.lucas-hdo.workers.dev`.
> - The D1 database is called `jikan-edge` and is on migration `0012`, not just `0001`.
> - **The R2 bucket was removed on 2026-07-30.** It was never referenced in `src/` and forced anyone
>   cloning the project to create a bucket — with an R2 subscription checkout — for nothing. D1 is the
>   only storage. If snapshots come back on the agenda, the binding comes back with the retention design.
>
> The evidence measurements below remain valid as a record of what was known on that date, but they have
> been superseded: the production CPU numbers are in
> [`2026-07-26-catalog-corpus-benchmark.md`](2026-07-26-catalog-corpus-benchmark.md) and the current state
> in [`production-readiness.md`](production-readiness.md). The original text follows below untouched.

## Published environment

- Worker: `https://jikanv2.lucas-hdo.workers.dev`
- D1: `jikanv2`, migration `0001_initial.sql` applied remotely.
- R2: `jikanv2-snapshots`, configured with no automatic snapshots in this milestone.

## Vertical slice evidence

- `/health` answered 200 on the published Worker.
- The public validation profile answered 200, persisted to D1, and the second read was a cache hit.
- Statistics, anime list and manga list all answered from the same slice; the lists were persisted and paginated over D1.
- Cloudflare observability recorded one published profile read with `cpuTime: 6 ms`, below the provisional 8 ms margin. That is a point measurement, not a p95.
- Local benchmark of the profile fixture: p95 below 1 ms across the milestone's runs. It isolates the parser and does not replace a real corpus benchmark.

Fields to expand in the next cycle: p50/p95 per corpus, aggregate cache hit rate, D1 reads/writes, upstream latency, failure/403/429, document size and suspicious-response rate.

Known risk: the lists HTML is public but subject to markup changes; the API does not consider a `200` sufficient and does not replace a valid cache with a suspicious document.
