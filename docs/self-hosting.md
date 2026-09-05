# Self-hosting jikan-edge

Running your own copy on your own Cloudflare account. No API keys, no upstream credentials, no
database to feed: the Worker fetches public MyAnimeList pages on demand and caches what it parsed.

Everything below was written against a real deploy. Where a number comes from Cloudflare's
documentation it is linked; where it comes from this project's own measurements it says so.

## Prerequisites

- **Node.js 20+** and npm.
- **A Cloudflare account.** The Free plan is enough to get it running — read
  [Free plan or Paid](#free-plan-or-paid) before putting it in front of anything real, because the
  10 ms CPU limit is a genuine constraint for this workload.
- Nothing else. There is no MyAnimeList account, token, or approval involved.

## Quick path

```bash
git clone https://github.com/LucasHenriqueDiniz/jikan-edge.git
cd jikan-edge
pnpm install
npx wrangler login

pnpm run setup        # creates your D1, writes its id into wrangler.jsonc, applies the migrations
npx wrangler deploy
```

Then confirm the deploy is actually usable — not just up:

```bash
curl https://<your-worker>.<your-subdomain>.workers.dev/health
```

```json
{ "data": { "status": "ok", "service": "jikan-edge", "checks": { "database": "ok" } } }
```

`checks.database` is the whole point of that call. `"ok"` means the schema is there and every route
can serve. Any other value is diagnosed in [Troubleshooting](#troubleshooting).

### Options

`pnpm run setup` accepts flags, all optional:

| Flag | Effect |
| --- | --- |
| `--worker-name=my-jikan` | Renames the Worker (default `jikan-edge`), so your `workers.dev` URL is yours. |
| `--db-name=my-db` | Names the D1 database (default `jikan-edge`). |
| `--contact=https://my-jikan.workers.dev` | Sets `MAL_USER_AGENT` to point at **you** — see [Running it responsibly](#running-it-responsibly). |

Re-running the script is safe: an existing database is reused, not duplicated, and migrations that
already ran are skipped. It never deploys — publishing stays a separate, deliberate command.

## What it sets up, and what it doesn't

| Resource | Needed? | Why |
| --- | --- | --- |
| **D1 database** | **Yes** | Every route reads the cache table before anything else. Created and migrated by `pnpm run setup`. |
| **Rate limiting bindings** | Yes, already configured | Nothing to create. `namespace_id` is [an integer you choose, scoped to your own account](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), so the values committed here work as-is in your account and share no counters with anyone else's. |
| **Static assets** (`site/`) | Included | The landing page at `/`. Deployed by `wrangler deploy` with no build step. |
| **R2 bucket** | **No** | An unused `SNAPSHOTS_BUCKET` binding used to be required here, forcing an R2 subscription for nothing. It was removed. |
| **Secrets / env vars** | No | The defaults in `wrangler.jsonc` are complete. Only `MAL_USER_AGENT` is worth changing. |

### Doing it by hand

If you would rather not run the script, it is four commands and one edit:

```bash
npx wrangler d1 create jikan-edge     # prints the database id
# paste that id into wrangler.jsonc → d1_databases[0].database_id
pnpm run db:migrate:remote             # applies migrations to the REMOTE database
npx wrangler deploy
```

The step people miss is the third one. `npm run db:migrate:local` — the one the README used to be the
only one to mention — migrates a local simulator file, not your deployed database.

## Troubleshooting

Start with `/health`, then read the logs live with `npx wrangler tail` while you hit a route.

| What you see | What it means | Fix |
| --- | --- | --- |
| `checks.database: "not_migrated"`, or `503 DATABASE_NOT_MIGRATED` on `/v1/*` | The database exists but has no schema. | `pnpm run db:migrate:remote` |
| `checks.database: "not_configured"`, or `503 DATABASE_NOT_CONFIGURED` | No D1 is bound to the Worker. | Check `d1_databases[0].database_id` in `wrangler.jsonc`, or re-run `pnpm run setup`. |
| `checks.database: "unavailable"` | The binding and schema are fine; D1 itself failed. | Retry, then check [Cloudflare status](https://www.cloudflarestatus.com/). |
| `500 INTERNAL_ERROR` on **every** route | A build from before this page existed: the two cases above were not diagnosed and surfaced as this. | Pull the latest `main` and redeploy. ([issue #1](https://github.com/LucasHenriqueDiniz/jikan-edge/issues/1)) |
| `Error 1102 — Worker exceeded resource limits` on heavy routes only | Free plan CPU limit. | [Free plan or Paid](#free-plan-or-paid) |
| `Error 1027` | Free plan daily request cap (100,000/day, resets at midnight UTC). | Wait, or upgrade. |
| `429 RATE_LIMITED` sooner than expected | The limiter counts per Cloudflare location, not globally, and is eventually consistent. | Expected behaviour; tune `limit` in `wrangler.jsonc` if you are the only user. |
| `404 NO_LOCAL_ENTRIES` on `/v1/random/*` | Random draws only from what your instance has already cached — by design, it never scans MAL for ids. | Fetch some entities first. |
| `/v1/anime/:id/streaming` returns `[]` | MAL resolves Cloudflare's network to a region with no availability data. | Not fixable from here; documented in [`routes.md`](routes.md). |

If none of these match, `npx wrangler tail` prints a JSON line per failure with the `requestId` that
the error response gave you.

## Free plan or Paid

Both work. The difference that matters for *this* workload is CPU time per request.

| | Workers Free | Workers Paid |
| --- | --- | --- |
| CPU per invocation | **10 ms**, fixed | 30 s default, up to 5 min |
| Requests | 100,000/day | 10 M/month included |
| D1 | 5 M rows read/day, 100 k written/day, 5 GB | 25 B rows read/month, 5 GB included |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) (checked 2026-07-30).

**Why 10 ms is tight here.** A cache *hit* is a single D1 read and stays well under it. A cache *miss*
fetches a MyAnimeList page and parses it, and this project's production measurements put those at
**p50 7 ms, p95 27 ms, max 48 ms** of CPU
([corpus benchmark](results/2026-07-26-catalog-corpus-benchmark.md)). So on the Free plan the cheap
routes are fine and the heaviest misses — long character lists, prolific staff pages, magazine
indexes — will return **Error 1102** until something else warms that entry into cache.

Practical reading: Free is fine for a personal instance with light, repetitive traffic. If you want
every route to answer reliably on a cold cache, the Workers Paid plan is what this project runs on.

## Running it responsibly

You are pointing a scraper at someone else's website under your own name. The defaults in this repo
are deliberately conservative — please keep them that way.

- **Set `MAL_USER_AGENT` to your own URL** (`--contact=` does it for you). Out of the box it names the
  upstream author's domain, which attributes your traffic to a stranger.
- **Keep the rate limiter.** It exists to protect MyAnimeList, not you.
- **Do not shorten the cache TTLs** to chase freshness. The 6 h/2 h defaults are what keep upstream
  load proportional to your users rather than to your traffic.
- **Only fetch the public pages already in `src/source/mal-urls.ts`.** No internal JSON endpoints, no
  headless browsers, no client-supplied URLs — the reasoning is in
  [`source-policy.md`](source-policy.md), and it is the difference between a cache and an attack.
- Your instance is **not affiliated with MyAnimeList or Jikan**. Say so if you publish it.

## Keeping a fork current

```bash
git remote add upstream https://github.com/LucasHenriqueDiniz/jikan-edge.git
git pull upstream main
pnpm install
pnpm run db:migrate:remote     # new migrations arrive with parser changes
npx wrangler deploy
```

`wrangler.jsonc` will conflict on `database_id` — keep yours. Everything else in that file should
usually follow upstream.

Parser fixes ship with a version token that invalidates affected cache rows automatically, so you do
not need to clear anything after an upgrade. Breaking changes to responses are listed in
[`CHANGELOG.md`](../CHANGELOG.md).

## Local development

See [`local-development.md`](local-development.md). Short version: `npm run db:migrate:local` then
`npm run dev:local` for the simulator, or `npm run dev` for remote bindings when you need to see how
MyAnimeList actually answers Cloudflare's network — which is not the same as how it answers your
laptop.
