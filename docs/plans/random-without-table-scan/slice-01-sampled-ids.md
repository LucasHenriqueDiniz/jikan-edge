---
status: doing
---

# Random without a table scan — Slice 01: draw from sampled ids

> **For agentic workers:** implement task-by-task, TDD, tests alongside the code. Steps use
> `- [ ]` checkboxes. One slice; nothing depends on another.

| | |
|---|---|
| **Delivers** | `/v1/random/{anime,manga,characters,people,users}` picks a uniformly random stored entity with two index lookups (≤ 33 rows read) instead of reading the whole table on every call |
| **Needs** | nothing new — the tables, `RandomRepository` and its tests exist |
| **Tests** | Task 1's list below: no `ORDER BY RANDOM()` issued, uniform within ±3% over a gapped id set, fallback after missed rounds, `null` on an empty table, `pickUser` over `rowid` |
| **Done when** | `pnpm test` is green, and one round of the new statements on the production D1 reports `rows_read` ≤ 33 for `anime` and `manga` (Task 2) — **measured 65**: D1 counts two rows per key looked up, so ≤ 33 was the wrong target (see Result) |
| **If stuck** | keep `ORDER BY RANDOM()` but select `mal_id` only and fetch the payload by key — still a scan of the key index, but it no longer reads every payload |

**Why (measured 2026-11-18, production D1, 2026-11-11 to 17):** the random pick is
`SELECT payload_json, fetched_at FROM <table> ORDER BY RANDOM() LIMIT 1`. SQLite has to read every
row — payload included — to sort by a random key. In that week only the anime pick ran: 71 calls,
**4,178,452 rows read (58,851 per call), 20% of every row the database read that week**, from 71 of
5,054,986 queries. p50 72 ms, p99 1.09 s. D1 runs one query at a time, so each call holds the
database for everyone else; the overload incidents of 2026-11-16 had this statement as the only
known heavy one (see `docs/routes.md`, "D1 overload").

**Architecture / decision:** rejection sampling over the primary key.

1. `SELECT max(mal_id) FROM <table>` — one index lookup (`mal_id` is the rowid alias).
2. Draw `PROBES` random ids in `[1, max]` and read
   `SELECT payload_json, fetched_at FROM <table> WHERE mal_id IN (…)` — at most `PROBES` rows.
3. Pick one of the rows found, uniformly. Every stored id is equally likely to be probed and, once
   found, equally likely to be chosen, so the pick stays uniform over what is stored — unlike
   `WHERE mal_id >= random() LIMIT 1`, which favours an id that sits after a long gap.
4. No row found → try again, up to `ATTEMPTS` times; then fall back to the next id at or after a
   random point (`WHERE mal_id >= ? ORDER BY mal_id LIMIT 1`, wrapping to the first id). That
   fallback is biased but costs one row, and only runs when the table is almost empty.
   **Superseded during implementation** — see Result: the fallback is the random sort over the key
   alone, because "almost empty" is exactly what a fresh self-hosted catalog is.
5. Empty table (`max` is null) → `null`, which `RandomService` already turns into
   `404 NO_LOCAL_ENTRIES`.

`users` has a text primary key, so it is the same scheme over `rowid` (`max(rowid)`,
`WHERE rowid IN (…)`); its rowids stay dense because a profile refresh is an upsert.

**Density, sampled in production 2026-11-18** (200 random ids per table, `mal_id IN (…)`):

| table | max id | found | density | stored rows (est.) | chance 32 probes all miss |
| --- | --- | --- | --- | --- | --- |
| anime | 65,463 | 93/200 | 46.5% | ~30k | 2×10⁻⁹ |
| manga | 197,953 | 80/200 | 40.0% | ~79k | 8×10⁻⁸ |
| characters | 307,325 | 102/200 | 51.0% | ~157k | 10⁻¹⁰ |
| people | 100,361 | 73/200 | 36.5% | ~37k | 5×10⁻⁷ |

So `PROBES = 32`, `ATTEMPTS = 3`: in practice one round, two statements, ≤ 33 rows read.

**Tech stack:** TypeScript, D1, Vitest. Code: `src/repositories/random.repository.ts` (the SQL),
`src/services/random.service.ts` (policy, unchanged). Randomness is injected so tests are
deterministic.

## Global constraints

- Never run a scanning query on the production D1 — the measurement steps below use bounded
  statements only (`max(rowid)` alone, `IN (…)` lists). See `.claude/CLAUDE.md`, D1 section.
- The interpolated table name stays a closed map (`TABLES`), never a caller string.
- No contract change: same routes, same body, same `404 NO_LOCAL_ENTRIES`, still `no-store`.
- After editing, check `git diff --stat` matches the change size (LF-only in `src/`/`tests/`).

---

## Task 1: sampled pick in `RandomRepository`

**Files:**
- Modify: `src/repositories/random.repository.ts`
- Test: `tests/repositories/random.repository.test.ts` (new), plus the existing
  `tests/routes/random.test.ts` stays green.

- [x] Write the failing tests first, against a fake D1 that records each statement and answers from
      an in-memory table:
  - a table with ids `{3, 7, 9}` and a seeded random source → the pick is one of them, and the
    statements issued are one `max(...)` and one `... IN (...)` — **no `ORDER BY RANDOM()`**;
  - uniformity: 30,000 draws over ids `{1, 2, 1000}` (a long gap before 1000) land on each id within
    ±3% of a third — the `>=` scheme would give 1000 ~99.8%;
  - all probes miss for `ATTEMPTS` rounds → the fallback statement runs and returns a row;
  - empty table → `null`, one statement;
  - `pickUser` uses `rowid`, same shape.
- [x] Implement with `random: () => number` injected (default `Math.random`), `PROBES = 32`,
      `ATTEMPTS = 3`. Draw distinct ids; cap the probe count at `max` for tiny tables.
- [x] Revert the implementation and confirm the tests go red; restore.

## Task 2: prove the cost on real databases

- [x] **Preview D1, through the app:** `wrangler dev --remote` (binds `jikan-edge-preview`), call each
      `/v1/random/*` route 20 times; every answer `200` or `404 NO_LOCAL_ENTRIES`, ids spread.
- [x] **Production D1, the statements alone:** with the guarded probe, run one round of the new
      statements by hand for `anime` and `manga` (`max(mal_id)`, then an `IN` list of 32 random
      ids) and record `rows_read` and `sql_duration_ms` from the response meta. Target: ≤ 33 rows
      against 58,851; the old statement is **not** run for comparison — the 7-day numbers above are
      the baseline.
- [ ] **After deploy:** `d1QueriesAdaptiveGroups` filtered on the new statement text, 7 days later —
      rows read per call and p99 against the baseline table above.

## Task 3: docs

- [x] `docs/routes.md`, random section: the sampling scheme and the measured before/after.
- [x] `.claude/CLAUDE.md` (and the `AGENTS.md` copy): replace "the known heavy statement is
      `ORDER BY RANDOM()`" with the result.
- [ ] `CHANGELOG.md`: an operational note only if latency is visibly different for callers;
      the contract does not change.

## Result (2026-11-18)

| check | outcome |
| --- | --- |
| unit tests (`tests/repositories/random.repository.test.ts`) | 9, red against `ORDER BY RANDOM()` (9 of 9), and each kills its mutant: always-fallback, first row found, random probes on a tiny table; an unbounded draw loop hangs the run |
| integration (`tests/integration/catalog.test.ts`, real SQLite) | 600 draws over ids `{3, 70, 900}` each within 10 points of a third; the `>=` fallback missed by 25 |
| production D1, statements by hand | first version: `max` 1 row, 0.6–0.8 ms, then `IN` of 32: **64 rows**, 4.3–12.4 ms (8 rounds, anime and manga). Final, one statement: **164 rows**, 3.5–20.2 ms, 15 rounds over all five tables; the plan is an index search for `max` and a rowid lookup per probe. Users: max rowid 4,722, 200 of 200 rowids probed are stored |
| preview D1 through the app, 20 calls per route | anime 20×200, 17 distinct of 61 stored (uniform expects 17.1); manga 20×200 over 2 rows; characters, people 20×404 `NO_LOCAL_ENTRIES` (empty); users: see `docs/routes.md` |

Three departures from the plan above:

- **The fallback is not `mal_id >= <random>`.** On the preview D1 (61 anime over 64,809 ids) nearly
  every pick reached it, and it drew the same anime 4 times in the first 6 picks — 12 distinct
  ids in 20. A fresh self-hosted catalog looks like that, and the old sort was uniform there. It
  is now `WHERE key = (SELECT key FROM … ORDER BY RANDOM() LIMIT 1)`: a scan of the keys, but
  only reached on a table mostly made of gaps, which is a small one. No wrap was needed either way.
- **`rows_read` per round is 64, not ≤ 32.** D1 counts two rows per key in an `IN` lookup, found
  or not (6 keys → 12 on a separate probe). One pick is 65 rows against 58,851.
- **One statement, not two.** The two-statement version shipped as `19ba28ff`, and from POA it
  answered ~110 ms slower than the sort (p50 0.30 → 0.41 s): each statement is a round trip to the
  database in ENAM. The keys are now drawn inside SQLite by a recursive CTE and the table LEFT
  JOINed on them, so a round is one statement again. D1 counts 164 rows for it — the CTE's rows
  included — which costs nothing that matters next to 58,851.

Left: the 7-day `d1QueriesAdaptiveGroups` check of Task 2, once the build is live.

## Out of scope

- Making `/random` draw from MAL's whole catalogue (it stays the local-catalogue policy).
- Caching a random pick — the route is `no-store` on purpose (`docs/routes.md`).
