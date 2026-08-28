# Production readiness — jikan-edge

Updated 2026-08-27. The 2026-07-19 verdict is preserved at the end as a record.

## Current decision

**In production and serving external traffic.** All 98 routes answer, there is a first external
consumer (issue #1, a self-hoster) and a second (PR #2, a port), and the 2026-08-27 sweep covered
124 calls with no 5xx at all. What is still missing is not what was missing in July.

| Area | State | Evidence | Remaining risk | Next action |
| --- | --- | --- | --- | --- |
| Suite | confirmed | 349 unit + 29 integration against a real D1; typecheck and dry run clean | two separate configs: `vitest run` on its own does not run `tests/integration/**` | — |
| Route coverage | confirmed | 124 calls captured, 114× 200 / 10× 400 / zero 5xx ([sweep](2026-08-27-route-audit-and-hardening.md)) | — | — |
| Query param contract | confirmed | `QUERY_CONTRACT` is the source of truth and `tests/routes/query-contract.test.ts` fails if a GET route has no entry | — | — |
| HTTP cache | confirmed | `Cache-Control` with remaining freshness, `ETag`/`If-None-Match`; 1,132,672 B → 0 on a 304 | — | — |
| Internal cache | confirmed | stale-while-revalidate measured in production; the request that crosses the TTL no longer blocks | — | — |
| CPU | confirmed on the paid plan | p50 7 ms / p95 27 ms / max 48 ms on a miss ([benchmark](2026-07-26-catalog-corpus-benchmark.md)) | **the Free plan returns `Error 1102` on the heavy routes** — the ceiling there is 10 ms | it is documented in `docs/self-hosting.md`; do not promise "runs on Free" without that caveat |
| D1 storage | **attention** | row ceiling measured at 4,194,256 B; largest row 1,207,652 B | 28.8% of the measured ceiling, but **60.4% of the documented one** (2 MB), and `characters-staff` only grows | design partitioning for large payloads before getting close |
| Self-hosting | confirmed | `npm run setup`, `503 DATABASE_NOT_MIGRATED`, `/health` with `checks.database`, `docs/self-hosting.md` | — | — |
| Rate limit | confirmed | key per global IP, burst 30/10 s + sustained 60/60 s, `Retry-After` on the 429 | it is colo-local and eventually consistent, by design of Cloudflare's API | — |
| Profile corpus | partial | validated against complete real profiles (Xinil 399, AMayacrab 360, Karinyia 2,354) | still not a statistical sample of 10 profiles per size band | — |
| 1042/404 | resolved in practice | has not recurred since the plan upgrade; the original investigation is still in [`cloudflare-1042-investigation.md`](cloudflare-1042-investigation.md) | — | — |

## Risks worth repeating

- **This project's expensive failure mode is a `200` with wrong data, not a `5xx`.** The five real
  defects found on 2026-08-27 all answered 200. No status check would have found any of them.
- **A synthetic fixture hides a missing field.** Two findings in that batch (F3 and the list parser
  before it) passed the tests precisely because the fixture lacked the real markup.
- **The D1 row ceiling is a cliff, not a curve.** The headroom between the documented and the measured
  value is real but not contractual.

## Previous verdict (2026-07-19), preserved

> **ready for development**. It does not yet meet the criteria for a controlled beta: it lacks a real
> corpus of 10 profiles, large/very large categories, HTTP cache/stale tests with a deterministic
> fetch, a private profile, a statistical comparison and a conclusive 1042 investigation.
>
> Tests: 11 unit, 5 local D1 integrations on the Workers runtime, none skipped. The network corpus
> remains limited to `AMayacrab`; it is not an operational benchmark.

Of what that list asked for: cache/stale with a deterministic fetch and the real list corpus were
done; the 1042 stopped occurring; the statistical sampling of profiles by size band was **not** done.
