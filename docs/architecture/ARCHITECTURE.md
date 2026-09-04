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
  ports/driven/    the two conversations a service is allowed to have: CatalogSource and
                   CatalogStore. Interfaces and their contract types, no implementations.
  adapters/        d1-catalog-store.ts, which composes the repositories into the store
                   port. The only place a D1 binding becomes a port.
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

Two, one per driven conversation, decided in
[the ports ADR](adr-ports-for-driven-dependencies.md) and named for the conversation rather than the
technology behind it:

| conversation | port | adapters |
|---|---|---|
| the catalog source | `CatalogSource` (`src/ports/driven/catalog-source.port.ts`) — one method, returning `SourceResult<string>` | `MalClient` (`src/source/mal-client.ts`), the real MAL fetch. Tests declare their own stand-ins against the interface. |
| the store | `CatalogStore` (`src/ports/driven/catalog-store.port.ts`) — cache bookkeeping, refresh leases, and the payload tables, grouped as members of one interface | `D1CatalogStore` (`src/adapters/d1-catalog-store.ts`), composing the repositories. Tests use it over a real D1 via `@cloudflare/vitest-pool-workers`, or an in-memory fake. |

**No D1 type appears in either port** — not `D1Database`, not `D1Result`. That is the property that
makes them ports rather than the driver with an interface in front of it, and it is checked by
`tests/services/anime-service-ports.test.ts`, which builds `AnimeService` from fakes alone and
cannot compile if a signature starts carrying one.

`SourceResult` was already behaving like a port contract before the ports existed: a domain-shaped
discriminated union (`success | not_found | private | rate_limited | timeout | suspicious |
upstream_error`), so no upstream `Response` reaches a service. `sourceError()` is the single place
that maps it to an HTTP status.

**The rollout is partial.** `AnimeService` receives both ports and constructs nothing; the other
eleven services still take a raw `D1Database` and build their own repositories, and
`src/app.ts:538`/`:548` still construct `RandomService` inline.
[Slice 3](../plans/dependency-injection/slice-03-roll-out-remaining-services.md) is the rest.

## Decisions

*Context, decision, and what it rules out. Newest first. A superseded entry stays, marked.*

### D6 — Biome is the linter and the formatter, and it starts in check-only mode

**Context.** There was no linter and no formatter at all; `tsc --noEmit` has no opinion about style,
unused values or floating promises. Turning any of them on rewrites `src/app.ts` in whatever diff it
happens to land in.

**Decision.** Biome 2.5.12, pinned exactly, configured to what the code already does (2-space, single
quotes, semicolons, LF, `lineWidth` 120) and wired to `pnpm lint` / `pnpm lint:fix` only — not to CI.
`files.includes` is an allowlist, so the tool cannot reach `tests/fixtures/*.html`, `.kanban.json` or
the CRLF files in `site/`. `organizeImports` is off. Decided 2026-09-04; the numbers behind each value
are in [`slice-01`](../plans/code-hygiene/slice-01-add-linter-check-only.md).

*Completed 2026-09-04 by slice 2: the reformat landed (139 files, tool-generated only), the 25
findings it could not fix were cleared by hand, and CI now runs `pnpm run lint` as its first step —
which amends D5.*

**Rules out.** ESLint + Prettier (two tools, a plugin chain, and formatting only via the second) and
oxlint (does not format). Also rules out reviewing a formatting change and a behavioural one in the
same diff: config, reformat and hand fixes are three commits by construction.

### D5 — CI runs typecheck and the unit suite, and no build

*Amended 2026-09-04 by D6: `pnpm run lint` is now the job's first step. The "and no build" half stands.*

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
| layer names | `domain / ports / application / adapters` + composition root | `domain / parsers / ports / adapters / source / repositories / services / http` | the names describe the four layers the spec asks for — `services` is the application layer, `source` + `repositories` are the driven side, `http` is the driving side — using the vocabulary the codebase and its whole test suite were written in. Renaming is a rename of everything, not a structural change. Undeclared, this reads as a missing hexagon. |
| driven grouping | group by resource, file per technology (`store/postgres.ts`) | `repositories/<resource>.repository.ts`, flat | there is exactly one technology (D1). A second one would need the directory-per-resource layout the `clean-code` skill describes. |
| some domain types live in `parsers/` | the domain owns its types | `Favorite`, `Favorites`, `UserUpdate`, `UserUpdates`, `SeasonArchiveEntry`, `ScheduleByDay`, `ClubRelations` are exported from parser files | not argued, just how they grew. A gap, below — not a divergence anyone should defend. Parse-result wrappers (`SeasonParseResult`, `ListParseResult`, the completeness-evidence types) do belong to the parser layer and stay. |
| Cloudflare resource names | `<owner>-<project>-<resource>-<env>` | `jikan-edge` (Worker) and `jikan-edge` (D1) | accepted as a permanent exception on 2026-09-03 — see [`adr-cloudflare-resource-names.md`](adr-cloudflare-resource-names.md). The Worker name **is** the `*.workers.dev` hostname `README.md` promises not to remove, and a differently-named D1 is a different database, so that rename is create-migrate-cutover against a live account. An audit will keep finding this gap; the ADR is the answer it should find. |
| the agent guide | one `CLAUDE.md` | two identical copies, `.claude/CLAUDE.md` and `AGENTS.md` | kept in step by `tests/config/agent-guide-sync.test.ts`. The test compares the two copies; it does not check that the paths they name exist, and a third copy at the repository root would sit outside the guard entirely. |

## Known gaps

*The violations that exist right now. Being honest here is what makes the rest of the file credible.*

- [ ] **`src/domain/pagination.ts` imports `ServiceError` from `../services/cacheable`** — the one
      arrow in the tree that points outward. The fix is a `src/domain/errors.ts` with a re-export left
      behind in `cacheable.ts`, which keeps it a two-line change instead of touching 15 files in `src/`
      and 4 in `tests/`.
- [ ] **Eleven of the twelve services still construct their own adapters.** `AnimeService` takes the
      two ports; the rest take a raw `D1Database`, and `RandomService` has no factory at all. The
      ports exist and the pattern is settled — this is the remainder of the rollout, tracked as
      [slice 3](../plans/dependency-injection/slice-03-roll-out-remaining-services.md).
- [ ] **`SourceResult` and `FetchBudget` still live in `src/source/`** and `CatalogSource` imports
      them from there, so the port points outward at its own adapter's directory. `CacheEntry` was
      moved into `catalog-store.port.ts` for exactly this reason; these two were left because
      `fetch-policy.ts` holds real policy alongside the type and splitting it is its own change.
- [ ] **Seven domain-shaped types are exported from `src/parsers/`** instead of `src/domain/`.
- [ ] **`src/app.ts` is 558 lines** — over the `clean-code` soft limit of 500, with handlers written
      as single very long lines.
- [x] ~~**The lint findings are measured but unfixed.**~~ Closed 2026-09-04 by slice 2. `pnpm lint`
      exits 0 on a clean tree and CI runs it. Still missing: a dead-code tool (`knip`). Biome's
      `noUnusedPrivateClassMembers` caught ten dead fields, but it only sees inside a class — an
      exported symbol nothing imports goes on looking used.
- [x] ~~**The vault is incomplete.**~~ Closed 2026-09-04. Every folder the `workflow` skill names now
      exists: `pitches/`, `plans/`, `postmortem/`, `product/`, `roadmap/`, `architecture/diagrams/`,
      each with the template README, plus `.obsidian/` and the `.mcp.json` that points a vault at
      `./docs`.
- [ ] **Two folders still hold what a standard one would**: `docs/planning/` (scope, risks,
      milestones) and `docs/results/` (probes, benchmarks, audits — the material a postmortem is made
      of). Renaming either breaks named links in `.claude/CLAUDE.md`, `AGENTS.md` and
      `../architecture.md` that **no test covers**, and `docs/README.md` names `planning/` in its own
      table. New records go to `postmortem/`; the two folders stay until a slice moves them with the
      links.
- [ ] **`docs/architecture.md` (9 lines) sits beside `docs/architecture/ARCHITECTURE.md` (208).** The
      first is a prose summary of the request flow, the second is the file of record. Two documents
      named for the same thing is how a reader ends up with the older one.
- [ ] **`docs/DEVLOG.md`, `docs/PROGRESS.md` and `docs/IDEAS.md` do not exist.** The `workflow`
      skill's implement step ends in one line in the first and a mark in the second; ideas that do
      not fit the current slice go to the third. Today that traffic has nowhere to land, so it ends
      up in `.claude/CLAUDE.md`, which is why that file is 48 KB.
