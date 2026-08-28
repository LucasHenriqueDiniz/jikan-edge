# Sweep of 124 calls and a hardening batch

Date: 2026-08-27. Unlike the earlier sweeps, this one did not compare routes against
`api.jikan.moe/v4` — it captured the request and response of **every route in this API** into a folder
per route and analyzed the whole corpus together: envelope shape, always-null fields, empty
collections, `snake_case` keys, headers, size and latency.

## Coverage

| | |
| --- | --- |
| Calls captured | **124 of 124 (100%)** |
| Status | **114× 200, 10× 400, zero 5xx** |
| Registered routes | 97 under `/v1/*` plus `/health` (the authoritative count: `QUERY_CONTRACT`, which `tests/routes/query-contract.test.ts` forces to cover every GET route) |

The 124 calls exceed the 98 routes because parameter variations (`?page=2`, `?filter=`, `?q=`) were
captured separately. The ten `400`s are all `INVALID_QUERY` on a search route called without
`q` — correct behavior, recorded as **F2** so it does not get reopened.

What the sweep confirmed as already healthy: a universal `{data, meta}` envelope, **zero** surviving
`snake_case` keys from the 2026-07-27 fix, and `meta.pagination` present on every route that accepts
`page`.

## Findings and what was done with each

| | Finding | State | Version |
| --- | --- | --- | --- |
| F1 | `?genres=` on its own returned an empty list, for anime and manga, for every id | fixed | `0523faba` |
| F2 | a search without `q` answers 400 | not a defect | — |
| F3 | `type` null on every season entry (1,021 in total) | fixed | `f7d1a163` |
| F4 | `avatarUrl` and `about` null on every profile | fixed | `9679c755` |
| F5 | none of the 124 responses carried `Cache-Control` or `ETag` | fixed | `9679c755` |
| F6 | divergent `meta` in the random group, and `random/users` cacheable | fixed | `aa5baaa9` |

The technical detail for each is in [`docs/routes.md`](../routes.md); the consumer-facing contract in the
[`CHANGELOG.md`](../../CHANGELOG.md).

**The shape of the defects matters more than the count.** None of the 124 calls failed — the five real
defects were all **200s with wrong or missing data**, which is the failure mode this project has
already identified as its most expensive. Two of them (F1, F3) were structural: the field could not be
right for any request, and even so nothing flagged it.

## New measurements

### D1 row size ceiling — the documentation diverges from the measurement

Probed against the real remote D1, writing through a bound parameter exactly as the repositories do, in
a throwaway Worker pointed at the same database:

| bytes in the row | result |
| ---: | --- |
| 4,194,256 | writes; the read comes back byte for byte identical |
| 4,194,257 | `D1_ERROR: string or blob too big: SQLITE_TOOBIG` |

That is 4 MiB (4,194,304) minus the 48 bytes of the other columns. The ceiling is **the row's**, not the
value's: padding the primary key with 1,000 more bytes dropped the boundary by the same amount. **Nothing
truncates** below the ceiling.

The [official documentation](https://developers.cloudflare.com/d1/platform/limits/) says
`Maximum string, BLOB or table row size: 2,000,000 bytes` — about **half** the measured value.

A method note: the first probe used literal SQL (`hex(zeroblob(...))`) and a 2.2 MB value went in. That
could have been a special SQL path, so it was redone through a bound parameter. The two paths agree.

Today's largest row: `catalog:anime:21:characters-staff` (One Piece), **1,207,652 bytes** — 28.8% of the
measured ceiling, **60.4% of the documented one**. The five largest are all `characters-staff`, the same
family that blew through the fetch ceiling earlier today; it is the same long-series pressure arriving at
the storage layer instead of the network layer. That is why the undocumented headroom is **not** something
to build on, and why the case became a `507 PAYLOAD_TOO_LARGE` (version `1f16e42c`) instead of a mute 500.

### Internal stale-while-revalidate

`wrangler dev --remote` with a 60 s TTL, same route and same page:

| | before | now |
| --- | ---: | ---: |
| cold miss | 1747 ms | 1747 ms (unchanged — there is nothing to serve) |
| fresh hit | 512 ms | 512 ms |
| **first request after the TTL** | did the cold miss's work | **686 ms**, `X-Cache-Status: stale` |
| next request | — | `hit`, `max-age=57` (the row rewritten by the background refresh) |

Also confirmed in production, where rows expired within the 6 h window genuinely existed:
`stale` at 861 ms, then `hit` with `max-age=21579` — a full TTL, written by the background task and not
by the request that answered.

### HTTP revalidation

`ETag` plus `If-None-Match` on `GET /v1/anime/21/characters`: **1,132,672 bytes → 0** on a `304`.

### MAL fetch limits

The 2 MiB per-document ceiling failed seven popular titles with a `502`; they never worked, and there was
no D1 row for any of them. Resolved in two stages: `MAX_UPSTREAM_BYTES` to 5 MiB
(`629508ce`, five titles recovered) and a per-call budget of 16 MiB / 20 s for character pages
(`5b41891e`, the remaining two). One Piece returns 541 staff members and 1,482 characters; Detective
Conan, 471 and 2,110.

## Suite state

| | |
| --- | --- |
| `vitest run` | 63 files, **349 tests** |
| `vitest run --config vitest.integration.config.ts` | 6 files, **29 tests**, against a real D1 |
| `tsc --noEmit` | clean |
| `wrangler deploy --dry-run` | ok |

**378 in total.** The two suites have separate configs — running only `vitest run` does not exercise
`tests/integration/**`.

Coverage that came into existence today, at points that were in production with no test at all:
`src/http/caching.ts`, `src/http/errors.ts` (every status in the `ServiceErrorStatus` union verified all
the way to the client), `src/config/env.ts` (reading the real `wrangler.jsonc`, so the published value and
the code's default cannot diverge silently) and `src/source/fetch-policy.ts`.

And a fixture that was synthetic became real: `tests/fixtures/anime/season-now-real.html`, nine cards
byte for byte from MAL's page, including the `kids` and `r18` variants and headers that deliberately
disagree with the cards' type. The old fixture had no `js-anime-type-all`, no header and none of those
variants — a parser reading the header would pass it and fail in production.

## Versions published today

`4ce71084`, `9d3445dd`, `a07e0742`, `629508ce`, `ebeba400`, `5b41891e`, `f2b389cd`, `086145f9`,
`2139e894`, `9679c755`, `44d028aa`, `0523faba`, `b9cf7782`, `f7d1a163`, `feaf775d`, `aa5baaa9`,
`dff313ec`, `61a0c56e`, `7f6b59d3`, `1f16e42c`, `cf954b67`, `6d099571`.

An operational note that cost time: `1f16e42c` took **~15 minutes** to appear, against the usual
~30-60 s. There was nothing wrong with the build. `wrangler deployments list` and
`wrangler versions list` show only what succeeded, so **the absence of a version does not distinguish
"delayed" from "broken"** — that distinction only exists in the dashboard's Builds tab.

## What stays open

- **The D1 row ceiling keeps getting closer.** The `507` turns the overflow into an explained error, it
  does not prevent it. If `characters-staff` keeps growing, the real fix is changing how large payloads
  are stored (partitioning by page, for instance), and that has not been designed.
- **The 4 MiB headroom is undocumented** and could be aligned with the documented 2 MB without warning.
  Against that number, One Piece is already at 60%.
- `anime/:id/episodes` still reads only MAL's first page.
- The unimplemented routes remain refused for the reasons already recorded in
  [`docs/routes.md`](../routes.md) — none was reopened by this sweep.
