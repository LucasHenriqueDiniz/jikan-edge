---
tags:
  - architecture
  - naming
  - status/accepted
---

# ADR — the Cloudflare resource names stay as they are

**Status:** Accepted, as an exception. The names do not change.
**Date:** 2026-09-03.
**Supersedes:** nothing. **Amends:** nothing in the code — this file records why an audit will keep
finding the same gap.

## Why this file exists

The house naming convention is `<owner>-<project>-<resource>-<env>`. Nothing in this account follows
it, and the two resources this repo owns are named `jikan-edge` (Worker) and `jikan-edge` (D1). A
future audit will flag that. It should find this file in the same search, because the gap is known
and the fix is more expensive than the gap.

The naming rule that applies here is the asymmetric one: a slug that crosses the repo boundary is
data, not a folder name. Both names crossed it — one into a public hostname, one into a live
database — so both are past the point where renaming is a config edit.

## What is actually deployed

Measured on 2026-09-03 with `wrangler d1 list` against the production account, then filtered
to the resources this repository owns. The account holds ten D1 databases and nine R2 buckets
in total, belonging to other projects; the claim below about naming conventions is about these
resources, not an audit of the account:

| D1 database | uuid | created | file size |
| --- | --- | --- | --- |
| `jikan-edge` | `71f8a596-7855-47a5-906c-9a1cf46e12ee` | 2026-07-19T18:23:10Z | 249,765,888 B (238 MiB) |
| `jikanv2` | `f49eddce-c8c6-496c-ba88-a21e5d86de73` | 2026-07-19T18:00:14Z | 204,800 B (200 KiB) |

`wrangler.jsonc` binds exactly one of them: `"database_name": "jikan-edge"` with
`"database_id": "71f8a596-…"` (lines 34-35 — the slice that ordered this note said 35-36, which is
off by one). The Worker name is `"name": "jikan-edge"`
(`wrangler.jsonc:3`).

The `num_tables` column read `0` for every database in the listing, this repo's included, so that
column carries no information here and no conclusion is drawn from it.

Two R2 buckets, `jikan-edge-snapshots` and `jikanv2-snapshots`, are recorded in
[`../results/vertical-slice-audit.md`](../results/vertical-slice-audit.md) and
[`../results/initial-viability.md`](../results/initial-viability.md). **Their live state was not
verified for this note:** the `wrangler r2 bucket list` call failed four times with
`error initializing client: authorization timeout` and no listing was ever obtained. The bucket
names below come from the repo's own records, not from a measurement.

## Cost of renaming the Worker: a public hostname

`workers_dev` is `true` on purpose, and `README.md:21` says of
`https://jikan-edge.lucas-hdo.workers.dev` that it "still serves the same Worker and is not
scheduled for removal — existing integrations keep working without a change."

The `*.workers.dev` hostname is derived from the Worker name. Renaming the Worker moves that
hostname and breaks the promise in the README for every consumer that integrated before the custom
domain existed. The custom domain `jikan.lucashdo.com` (`wrangler.jsonc:11`) is unaffected by a
rename, so the whole cost falls on the consumers who are not using it — the ones with the least
reason to be watching for a change.

Renaming would mean either withdrawing that sentence from the README, or keeping the old Worker
alive as a redirect shim. Neither is worth a name that reads correctly in a dashboard.

## Cost of renaming the D1 database: create, migrate, cut over

D1 has no rename. A differently-named database is a different database, reached by a different
`database_id`. Renaming `jikan-edge` means:

1. `wrangler d1 create <new-name>`;
2. applying every migration in `migrations/` to it;
3. copying 238 MiB of cache rows and normalized entities across, or accepting a cold cache and
   re-scraping MyAnimeList for all of it — which the source policy rate-limits on purpose;
4. rewriting `database_name` and `database_id` in `wrangler.jsonc`, plus the two literal
   `jikan-edge` arguments in the `db:migrate:local` and `db:migrate:remote` scripts in
   `package.json`;
5. deploying, verifying `/health` reports `checks.database` as `ok`, and only then deleting the old
   database.

That is a cutover with a rollback plan, against the one database serving traffic, in exchange for
nothing a reader of this file cannot get from this file.

## What a compliant name would have been

For the record, so that the next resource created in this account starts right rather than
inheriting this exception:

```text
lucashdo-jikan-edge-api-prod    # Worker
lucashdo-jikan-edge-db-prod     # D1
lucashdo-jikan-edge-snapshots-prod   # R2, if snapshots ever come back
```

The exception is scoped to the two resources named above, and to them only because they already
hold data and a hostname. Anything created from here on takes the convention.

## The constraint any future rename has to respect

`scripts/setup.mjs` is the first command a self-hoster runs, and it patches `wrangler.jsonc` by
regex, not by parsing. Three of its patterns are naming-sensitive:

- `("database_id"\s*:\s*")[^"]*(")` and `("database_name"\s*:\s*")[^"]*(")` — a fork's own D1 name
  and id;
- `^(\s*"name"\s*:\s*")[^"]*(")`, anchored to the start of a line so it cannot hit the `"name"` of a
  rate limiter, which is what `--worker-name` rewrites.

`applyPatches` throws if any pattern misses, so a config restructuring that moved these keys would
break setup loudly rather than silently. Its pure helpers are covered by
`tests/scripts/setup.test.mjs`. Whatever names are eventually chosen, `npm run setup` has to keep
working, and the default `dbName` inside `main()` is the literal `'jikan-edge'`.

## Finding: `jikanv2` and both snapshot buckets are unreferenced

Not part of the decision above, and not acted on here.

`jikanv2` was the project's earlier name — [`../results/initial-viability.md`](../results/initial-viability.md)
records the Worker `jikanv2.lucas-hdo.workers.dev`, the D1 `jikanv2` and the R2 `jikanv2-snapshots`
from that milestone, and [`../results/vertical-slice-audit.md`](../results/vertical-slice-audit.md)
records that the old `jikanv2` resources "were preserved, not deleted" when the project was
republished as `jikan-edge` 23 minutes later.

Grepping case-insensitively for `jikanv2`, `jikanv2-snapshots`, `jikan-edge-snapshots` and
`SNAPSHOTS_BUCKET` across `wrangler.jsonc`, `package.json`, `src/`, `scripts/`, `migrations/`,
`tests/`, `site/` and `.github/` returns **zero hits in all eight**. Every surviving mention of
`jikanv2` is in prose: `AGENTS.md:5`, `.claude/CLAUDE.md:5`, and the two `docs/results/` files above.
The R2 side is already explained — the `SNAPSHOTS_BUCKET` binding was removed on 2026-07-30
([`../architecture.md`](../architecture.md), `AGENTS.md:66`) and D1 is the only storage.

So, on the evidence available: the `jikanv2` D1 and both snapshot buckets are orphaned relative to
this repo's configuration and code. Two things are **not** established and should not be assumed:

- whether the 200 KiB in `jikanv2` is stale schema or data someone still wants — no query was run
  against it;
- whether another repo in this account binds any of these resources — only this repo was grepped.

Deleting them is the owner's call and needs those two checks first. Nothing was deleted, renamed or
modified for this note; it is a read-only inventory plus this file.
