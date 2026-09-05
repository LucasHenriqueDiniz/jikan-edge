---
tags:
  - architecture
  - status/accepted
---

# ADR — ports for the driven dependencies

**Status:** Accepted. Option A, sequenced with the source port first.
**Date:** 2026-09-03.
**Supersedes:** nothing. **Amends:** the two `no ports/` / `wiring` rows in
[`ARCHITECTURE.md`](ARCHITECTURE.md#divergences-from-the-house-style) and the second bullet of its
[known gaps](ARCHITECTURE.md#known-gaps), which recorded the divergence without deciding it. This
acceptance removes all three and rewrites that file's Ports section around the ports that now exist.

> ⚠️ **The `src/app.ts:NNN` line numbers below describe the tree on 2026-09-03 and no longer resolve.**
> They are evidence for the decision at the moment it was taken and are deliberately not rewritten —
> an ADR that gets its numbers refreshed stops being a record of what was known. Where things are
> today: the eleven factories at `:111-121` are twelve at `src/app.ts:149-195`, they hand over a built
> `D1CatalogStore` and `MalClient` instead of `c.env.DB`, and the two inline
> `new RandomService(c.env.DB)` calls at `:530`/`:540` are gone — `RandomService` has a factory beside
> the others, and the route handlers it lived in moved to `src/http/routes/random.routes.ts`. The
> decision was carried out in full; see [[ports-and-injection]] in `docs/postmortem/`.

**Why this file lives in `docs/architecture/` and not `docs/adr/`.** [`../README.md`](../README.md)
reserves `adr/` for "formal architecture decisions once there are mature alternatives", and this
decision has two. Seeding that folder was the alternative and it costs more than it buys: a second
architecture-docs folder holding one file, plus an edit to the `docs/README.md` table to flip
`adr/` from `reserved` to `started`. `ARCHITECTURE.md` already links this question from its own
Ports section, and an ADR that amends that file belongs beside it. `adr/` stays reserved.

## Context

The house style has two rules on this, and both are quoted here so the argument is with the actual
text rather than with a paraphrase. From <https://imgabriel.dev/architecture/>:

> Whether a dependency gets a port: always, from its first use. How many ports you end up with: as
> few as the conversations you actually have.

and

> Use cases receive their ports. A use case never constructs an adapter. If `DiskStore::new()` shows
> up inside application code, the boundary is already gone; no folder structure will save it.

This repo breaks both. There is no `src/ports/` directory. A service takes a raw `D1Database` and
builds its own adapters: `src/services/anime.service.ts:60` constructs five collaborators —
`CacheRepository`, `RefreshLockRepository`, `AnimeRepository`, `CatalogListRepository` and
`MalClient` — from the binding it was handed. Ten sibling services do the same on one line each.
Across `src/services/` there are **53 `new` calls on an adapter class**: 11 × `CacheRepository`,
11 × `RefreshLockRepository`, 11 × `CatalogListRepository`, 11 × `MalClient`, and 9 resource
repositories one apiece.

The composition root exists and does construct, but it hands over the binding rather than the
adapters. `src/app.ts:111-121` is eleven one-line factories, each of the shape
`new XService(c.env.DB, configFrom(c.env), undefined, background(c))`. Two more callsites miss the
factories entirely: `new RandomService(c.env.DB)` at `src/app.ts:530` and `:540`, inline in the two
random route handlers. `RandomService` is the one service with no factory and the one that takes the
raw binding straight into `this.db.prepare(...)` (`src/services/random.service.ts:10`).

The surface this decision covers, counted:

| | count |
|---|---|
| files in `src/services/` | 15 (12 `*.service.ts`, plus `cacheable.ts`, `genre-filter.ts`, `top-filter.ts`) |
| files in `src/repositories/` | 12 |
| lines of code, `src/services/` + `src/repositories/` | 1,857 + 194 |
| public methods across the 12 repositories | 28 (27 `async`, plus `CacheRepository.isFresh`) |
| factory functions handing over a raw `c.env.DB` | 11, at `src/app.ts:111-121` |
| service constructions outside those factories | 2, at `src/app.ts:530` and `:540` |
| adapter constructions inside `src/services/` | 53 |
| `D1Database` mentions in `src/repositories/` | 12, every one a constructor parameter |
| D1 driver types in a repository's public method signature | 0 (`D1PreparedStatement` appears once, as a local at `user.repository.ts:31`) |
| baseline suite | 64 test files, 351 tests, `pnpm typecheck` silent |

### What a port would actually buy here

This is the part the audit could not answer, and it has to be answered with measurements rather
than with the word "testability".

**Testability is already banked.** Eleven of the twelve services take an optional
`source?: MalClient` alongside the `D1Database` — `src/services/anime.service.ts:59` and ten
siblings — and fall back to `new MalClient(config)` when it is omitted. `RandomService` is the one
that does not. In `tests/`, 19 service constructions across 7 files: **18 of the 19 already pass a
stand-in through that parameter.** A port would make the seam uniform, not newly possible. Any
version of this ADR that claims ports unlock testing here is wrong on the evidence.

**The one measured win is type checking at the seam.** Of those 18, **13 pass the fake through
`as never`** — `tests/services/search-service.test.ts:23`, `:39`,
`tests/services/search-genre-only.test.ts:61`, `tests/services/search-filters.test.ts:15` and nine
sites in `tests/integration/entity-cache-priming.test.ts` and `anime-cache-priming.test.ts`. At
those 13 sites the compiler checks nothing about the fake: it is asserted into the concrete
`MalClient` type. A named interface the fake could declare is what removes the cast, and 13 is the
whole size of that prize. Two of those files additionally carry a private copy of the same D1
stand-in (`stubDb()` at `search-service.test.ts:5` and `search-genre-only.test.ts:51`).

**The remaining 5 sites need no cast, and that is the uncomfortable fact.**
`tests/integration/user-list-guards.test.ts:48`, `:55`, `:64`, `:72` and `:79` pass a *real*
`MalClient` built over a fake network, because `MalClient`'s constructor already takes an injectable
`fetcher` (`src/source/mal-client.ts:18`). A type-checked seam for the source already exists one
layer lower than the port would sit. The port improves the 13 sloppy sites; it does not create the
capability, and the 5 careful sites show the capability was there without it.

**On Workers the alternative to D1 is another D1.** D1 is the only relational binding in the
runtime; KV is not relational and R2 is object storage, and the `SNAPSHOTS_BUCKET` binding that
would have made R2 a second store was removed in 2026-07-30 (`ARCHITECTURE.md` D2). The D1 tests
run against a *real* D1 through `@cloudflare/vitest-pool-workers`, so no test wants a second
adapter either. There is no plausible second implementation and no test demand.

**So, plainly: the store port would exist to satisfy the rule, and for no other reason.** It buys
no swap, no test that is not already possible, and no type safety the repository signatures do not
already have. Recording that here is the point of the file — the next reader should not have to
rediscover it, and nobody should later defend the store port with a benefit it does not have.

The one genuine argument for it is the one the house style makes about itself, and it is fair:

> The first answer is where I break with the canon, so I will say it plainly. Everyone who endorses
> abstracting the database and the clock grounds it in needing a test seam. […] Not one of them
> writes "at first use, regardless of testability." I do.

The rule is explicitly *not* grounded in testability. "Testing already works" is therefore not a
rebuttal to it — it is a rebuttal to a justification the rule does not use. What is left is a bet
on optionality, and the honest cost of that bet is below.

## Options

### A — ports for both conversations, injection from the root

`src/ports/driven/` gains an interface per conversation, the repositories and `MalClient` declare
themselves implementations, services receive ports, and `src/app.ts` does all construction.

*How many ports.* Grouped by conversation, as the rule demands, this is **2**: a catalog source and
a store. The store variant is one interface carrying the **28** public methods currently spread
over 12 classes. One interface per repository would be **12**, which the spec names by hand as the
failure mode ("port explosion […] one trait per struct, one mock per trait"). A middle shape — the
3 shared repositories (`cache`, `refresh-lock`, `catalog-list`) as their own ports plus one per
resource — is **12** by another route. Slice 2 of the plan settles this by doing it once; this ADR
records that 2 is the rule-compliant answer and 28 methods is its price.

*What changes.* Under `src/`: 12 `*.service.ts` constructors, `CacheDeps` at
`src/services/cacheable.ts:62` (shared by every service, so it changes once and the rest follow),
12 repository files gaining an `implements` clause, and `src/app.ts`. The 53 adapter constructions
move out of `src/services/` and into the root, where the 11 one-line factories at `:111-121` become
11 factories building roughly five collaborators each, and a 12th factory has to be added for
`RandomService` so `:530` and `:540` stop constructing inline.

*What it costs that is not a file count.* `src/app.ts` is 550 lines today, already past the
`clean-code` 500-line soft limit that `ARCHITECTURE.md` lists as a known gap. Absorbing 53
constructions makes that number worse in the same change. The extraction itself is mechanical:
0 of the 28 repository method signatures mention a D1 driver type, so the store interface is a copy
of signatures that already speak domain types.

*Tests.* 19 constructions in 7 files rewritten. 13 `as never` casts on the source argument
disappear. The 2 copies of `stubDb()` collapse into one fake store adapter, which is a real adapter
in this style rather than test-only code. The suite has to come back at 64 files / 351 tests; a
lower count means a test was deleted rather than adapted.

*Risk.* If a port signature ends up carrying `D1Database` or `D1Result`, it is the driver with an
interface in front of it and the change has bought nothing. The 0 in the table above says that
should not happen, but it is the thing to check first, not last.

### B — record the divergence, change no code

The ADR is the deliverable and nothing under `src/` moves.

*What it costs.* 0 files under `src/`, 0 test files, suite unchanged at 64 / 351. The documentation
half is already written — 2 rows in the `ARCHITECTURE.md` divergences table and 1 bullet in its
known gaps — so the marginal cost of this option is this one file.

*What stays broken, with numbers.* 13 test sites keep `as never` and stay unchecked at the seam.
2 copies of `stubDb()` stay. 53 adapter constructions stay inside `src/services/`. 1 of the 12
services (`random.service.ts`) keeps no seam at all: no `source?` parameter, no factory, and 2
inline constructions at `src/app.ts:530` and `:540`. And the repo keeps a stated divergence from a
house rule it otherwise follows, which is a cost paid every time someone reads the style and then
reads the code.

### C — source port only

Derived from the measurements above rather than proposed by the audit, and listed because it is the
cheapest thing that buys the entire measured benefit.

*What changes.* **1** new interface for the catalog conversation. The `source?: MalClient`
parameter retypes in 11 services (`src/services/anime.service.ts:59` and ten siblings), `MalClient`
declares it, and the 11 factories at `src/app.ts:111-121` keep their current arity — they already
pass `undefined` there. **0** repository files change, **0** of the 53 constructions move, and
`src/app.ts` stays at 550 lines.

*What it buys.* All **13** casts. Nothing else.

*What it does not do.* Satisfy the rule. D1 is still reached concretely from 12 services and
`src/app.ts` still hands over a raw binding, so the wiring divergence survives in full and this ADR
would have to be reopened rather than closed.

## Decision

**Option A, sequenced so the measured payoff lands first.** The owner delegated this choice to the
house style, and the house style's answer is not ambiguous: a driven dependency gets a port from its
first use, and a use case never constructs an adapter. Both driven conversations get a port; there
are **2** of them, named for the conversation and not the technology.

Sequencing, because the two halves are not equally justified:

1. **The source port first** — the Option C work. 1 interface, 11 service signatures, 13 casts
   removed, `src/app.ts` untouched. This is the half with a measured benefit, and shipping it first
   means the rollout is worth something even if it stalls.
2. **The store port second** — 28 signatures, 53 constructions relocated, a 12th factory for
   `RandomService`. This half is rule-compliance. It buys no swap and no new test. That is recorded
   in Context above and is not to be re-argued as a benefit later.

Slice 2 of [the plan](../plans/dependency-injection/slice-02-pilot-anime-service.md) settles the
port shape on `AnimeService` before the rollout, and its own stop condition stands: a port signature
carrying a D1 type is not a port, and finding one is evidence against the change rather than
something to ship.

**Accepted by the owner on 2026-09-03.** It was a call about how much rewrite a one-person project
absorbs for a rule it can otherwise document its way out of, and Option B remained a defensible
answer — which is why it is costed above rather than dismissed. B was not taken. Slices 2 and 3 are
unblocked, and the two `ARCHITECTURE.md` divergence rows are removed rather than left provisional.

## Consequences

**If A is accepted.**

- `src/ports/driven/` exists and is the fourth layer the house style asks for; the divergence table
  in `ARCHITECTURE.md` loses its `no ports/` and `wiring` rows and the known-gaps bullet that names
  them.
- `src/app.ts` grows. It is 550 lines against a 500 soft limit before the change, and it absorbs 53
  constructions plus a 12th factory. Splitting the composition root out of the route file becomes a
  live requirement rather than a listed gap.
- 13 test sites become type-checked at the seam and `as never` stops being the house idiom for a
  fake. The 2 `stubDb()` copies become one in-memory store adapter under `adapters/`, which is
  production code in this style and gets a contract test at the port.
- `RandomService` gets a factory and stops being constructed inline, which is a prerequisite rather
  than a tidy-up: without it `src/services/` cannot stop naming `D1Database`.
- The store port is carried at a maintenance cost with no swap behind it. Every new repository
  method becomes two edits instead of one, 28 signatures becoming 29 and so on. This is the price
  of the rule and it is being paid deliberately.

**If B is accepted.** The three consequences to accept in writing: 13 unchecked test seams, 53
adapter constructions inside the application layer, and a stated divergence that every future audit
will raise again unless this ADR is the recorded answer. The mitigation is that this file exists.

**Either way.** Nothing crossing the repo boundary moves. No D1 database, table or column is
renamed, no route changes, no binding changes, and no migration is implied — this is a source-level
decision only. The 4,194,256-byte row ceiling (D4) and the caching contract (D3) are untouched by
both options.

**What would reopen this.** A second store adapter becoming real — a non-D1 relational binding on
Workers, or a deployment target that is not Workers at all. Either one turns the store port from
rule-compliance into the thing that makes the move cheap, and the argument above would have to be
rewritten rather than cited.
