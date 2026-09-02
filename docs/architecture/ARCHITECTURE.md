---
tags:
  - architecture
  - status/active
---

# Architecture — jikan-edge

> **This file records what already holds in the code, so nobody re-decides it per feature.**
>
> It is not a rules file and it is not aspirational. The house style lives in the `hexagram`
> plugin and in <https://imgabriel.dev/architecture/>. What goes here is this project: the shape
> that is actually built, when each piece was decided, where it diverges from the house style and
> why, and what is still wrong.

Two neighbouring files, and what each is for:

- [`../architecture.md`](../architecture.md) — the prose walkthrough of the request flow. Still current.
- [`initial-decisions.md`](initial-decisions.md) and [`source-strategy.md`](source-strategy.md) —
  the discovery-phase proposals, kept as the record of what was considered. Partly superseded; the
  marks are in those files.

## How to keep this file

Four habits, and they are the whole point of the format:

- **Record, do not prescribe.** Present tense, about the code as it stands.
- **Date every decision.** `Decided YYYY-MM-DD.` A reader needs to know whether a line predates the
  thing they are looking at.
- **Declare divergence from the house style, with the reason.** A divergence stated is a decision. A
  divergence unstated is a bug somebody will helpfully fix.
- **End with your own gaps.** A file that lists its own violations gets trusted. One that does not gets
  read once.

---

## The shape

*What the tree looks like and what each directory is for. Only what exists.*

```
src/
  domain/          entities and value objects for every resource, plus each resource's
                   PARSER_VERSION constant. Types and small pure helpers only.
  parsers/         pure HTML -> domain. Given a string, returns a domain value or throws
                   ParserError. Never fetches, never touches the database.
  source/          the driven side of MyAnimeList: MalClient, URL builders, response
                   validation, fetch policy, the SourceResult union.
  repositories/    the driven side of D1. One file per resource, plus cache.repository
                   and refresh-lock.repository for the shared cache tables.
  services/        the use cases. One per resource, coordinating source + parser +
                   repository. cacheable.ts holds withCache, ServiceError,
                   ServiceResponse<T> and sourceError().
  http/            the driving side: error mapping, cache headers, query contract and
                   guards, response envelope, setup diagnostics.
  config/env.ts    reads the Worker bindings into a RuntimeConfig with fallbacks.
  observability/   structured metric lines.
  app.ts           the Hono app: routes, middleware, and the per-request wiring.
  index.ts         the Worker entry point. Two lines.
```

The request flow is the same one [`../architecture.md`](../architecture.md) describes:
public MAL HTML → `MalClient` → response validation → pure parser → normalized domain → D1 / cache →
Hono → client.

## Ports

*One line per port: the conversation it names, its adapters, and why it exists.*

**There is no `src/ports/` directory, and no interface declared for either driven dependency.**
The two conversations exist as concrete classes instead:

| conversation | how it is expressed | implementations |
|---|---|---|
| the catalog source | `MalClient` (`src/source/mal-client.ts`), returning `SourceResult<T>` | one, the real MAL fetch. Tests inject a stand-in `MalClient` through the service's optional `source` parameter. |
| stored state | one repository class per resource over `D1Database` | one, D1. Tests run against a real D1 via `@cloudflare/vitest-pool-workers`, or pass a hand-built `CacheDeps`. |

`SourceResult` is the one piece that already behaves like a port contract: it is a domain-shaped
discriminated union (`success | not_found | private | rate_limited | timeout | suspicious |
upstream_error`), so no upstream `Response` reaches a service. `sourceError()` is the single place
that maps it to an HTTP status.

Whether these become real ports is [an open decision](#known-gaps), not something this file settles.

## Decisions

*Context, decision, and what it rules out. Newest first. A superseded entry stays, marked.*

### D5 — CI runs typecheck and the unit suite, and no build

**Context.** Workers Builds compiles and publishes on every push to `main` and reports back as a check
on the commit. A `wrangler deploy --dry-run` step in CI repeats that compilation without publishing.

**Decision.** CI runs `pnpm run typecheck` and `pnpm test` only. Decided 2026-09-02.

**Rules out.** CI catching a bundler-only failure before the host does. The host's own check is the
signal for that.

### D4 — an unstorable row gets a typed answer, not a 500

**Context.** D1 refuses a row over its ceiling with `SQLITE_TOOBIG`. Measured against the real remote
D1 on 2026-08-27: 4,194,256 bytes stores and 4,194,257 raises, and the ceiling is per row, not per
value.

**Decision.** `isOversizeRow()` matches `SQLITE_TOOBIG` and nothing looser, and the resource answers
with a typed 507 `PAYLOAD_TOO_LARGE` instead of a bare 500. Decided 2026-08-27.

**Rules out.** A size check of our own, and any looser string match — widening it turns an ordinary bug
into a reported capacity limit and sends whoever debugs it the wrong way.

### D3 — one shared cache orchestration, not one per entity

**Context.** Cache / stale / lease handling started as a private method belonging to `UserService`, and
every new resource wanted the same thing.

**Decision.** `withCache` in `src/services/cacheable.ts` owns it, and every service delegates. If stale
data exists and the source fails, the answer is still a 200 carrying `meta.stale=true` and
`meta.refreshFailed=true`.

**Rules out.** Per-resource freshness rules that drift apart. A resource that genuinely needs different
behaviour reads D1 directly and advertises no cache lifetime (the random picks do this).

### D2 — D1 is the only storage

**Context.** [`initial-decisions.md`](initial-decisions.md) proposed splitting payload from index, with
R2 as a candidate for the canonical document. The `SNAPSHOTS_BUCKET` binding existed for that and was
never referenced from `src/`.

**Decision.** The binding was removed — [`../architecture.md`](../architecture.md) records
2026-07-30 — and D1 holds both the normalized entities and `cache_entries`. Single-record resources get
a dedicated table with a `payload_json` column; list-shaped resources with no entity of their own use
the generic `catalog_lists` table keyed by `resource_key`.

**Rules out.** The payload/index split, and the benchmark that was going to decide it. **This supersedes
item 2 of `initial-decisions.md`.**

### D1 — the source is MyAnimeList's public HTML, not the official API

**Context.** Reproducing the public, cached data model that made Jikan useful, without depending on the
official API's coverage, credentials or contract.

**Decision.** Scrape public MAL HTML, under the limits in
[`source-strategy.md`](source-strategy.md): no login, no cookies, no private data, no CAPTCHA or
challenge circumvention, never on a consumer's synchronous path, always cached and rate-limited.
Decided during discovery; the two files carry no date of their own.

**Rules out.** The official MAL API for now, and any Jikan payload-parity promise — this API serves its
own `/v1`.

## Divergences from the house style

*Where this project does something the house style says not to, and the argument.*

| what | house style says | here | why |
|---|---|---|---|
| layer names | `domain / ports / application / adapters` + composition root | `domain / parsers / source / repositories / services / http` | the names describe the four layers the spec asks for — `services` is the application layer, `source` + `repositories` are the driven side, `http` is the driving side — using the vocabulary the codebase and its whole test suite were written in. Renaming is a rename of everything, not a structural change. Undeclared, this reads as a missing hexagon. |
| no `ports/` | a driven dependency gets a port from its first use | concrete `MalClient` and repository classes | there is one implementation of each, and the seam that makes them testable already exists: `SourceResult` keeps upstream types out of the services, and the services take an optional `source`. Adding the interfaces is a real option, listed below as a gap rather than settled here. |
| wiring | a use case never constructs an adapter; only the composition root constructs | a service takes `D1Database` and builds its own repositories, and falls back to `new MalClient(config)` when no `source` is passed | `app.ts` is the composition root and it does construct per request, but it hands over the raw binding rather than built adapters. The `source ?? new MalClient(config)` default is what lets a test inject a stand-in without a container. It is still an inward-pointing violation of the wiring rule. |
| driven grouping | group by resource, file per technology (`store/postgres.ts`) | `repositories/<resource>.repository.ts`, flat | there is exactly one technology (D1). A second one would need the directory-per-resource layout the `clean-code` skill describes. |
| some domain types live in `parsers/` | the domain owns its types | `Favorite`, `Favorites`, `UserUpdate`, `UserUpdates`, `SeasonArchiveEntry`, `ScheduleByDay`, `ClubRelations` are exported from parser files | not argued, just how they grew. A gap, below — not a divergence anyone should defend. Parse-result wrappers (`SeasonParseResult`, `ListParseResult`, the completeness-evidence types) do belong to the parser layer and stay. |
| no linter or formatter | — | typecheck and tests only | turning one on today rewrites `src/app.ts` (550 lines, with one handler line of 747 characters) in the same diff as anything else. Whoever adds it takes the reformat as its own commit. |

## Known gaps

*The violations that exist right now. Being honest here is what makes the rest of the file credible.*

- [ ] **`src/domain/pagination.ts` imports `ServiceError` from `../services/cacheable`** — the one
      arrow in the tree that points outward. The fix is a `src/domain/errors.ts` with a re-export left
      behind in `cacheable.ts`, which keeps it a two-line change instead of touching 15 files in `src/`
      and 4 in `tests/`.
- [ ] **No `ports/` layer for D1 or for the MAL client**, and services construct their own adapters.
      Both are listed as divergences above because they are deliberate today, not because they are
      right.
- [ ] **Seven domain-shaped types are exported from `src/parsers/`** instead of `src/domain/`.
- [ ] **`src/app.ts` is 550 lines** — over the `clean-code` soft limit of 500, with handlers written
      as single very long lines.
- [ ] **No lint, format or dead-code gate.** `pnpm run typecheck` and `pnpm test` are the whole
      check surface; there is no eslint/biome/prettier config and no `knip`.
- [ ] **Cloudflare resource names do not follow `<owner>-<project>-<resource>-<env>`.** Renaming a D1
      database is a data migration, not a `git mv`, so this is not a drive-by fix — see the `naming`
      skill.
- [ ] **Two copies of the project guide** (`.claude/CLAUDE.md` and `AGENTS.md`) kept in step by
      `tests/config/agent-guide-sync.test.ts`. The test compares the two copies; it does not check that
      the paths they name exist. A third copy at the repository root would sit outside that guard
      entirely.
- [ ] **The vault is incomplete**: `docs/pitches/`, `docs/plans/`, `docs/postmortem/`, `docs/product/`
      and `docs/roadmap/` do not exist, and `docs/planning/` and `docs/results/` hold what two of them
      would. Renaming those two breaks named links in `.claude/CLAUDE.md`, `AGENTS.md`,
      and `../architecture.md` that no test covers, and `docs/README.md` names `planning/` in its own
      table.
