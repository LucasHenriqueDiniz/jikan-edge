---
tags:
  - postmortem
  - kind/plan
  - area/architecture
  - ports
  - dependency-injection
  - checkpoint-gates
closed: 2026-09-03
cost: "one debug cycle lost to a gate that matched text instead of code"
---

# Ports for the driven dependencies, decided and piloted

> Closed 2026-09-03 · jikan-edge@3244116 · plans: [[slice-01-adr-for-ports]], [[slice-02-pilot-anime-service]] · decision: [[adr-ports-for-driven-dependencies]] · pitch still live: [[dependency-injection]]

⚠️ **Written retroactively on 2026-09-04**, from `git log`, the two plan files' own `Outcome`
sections and a re-run of the suite — not from memory of the session that shipped it. The numbers
below were re-measured today; where a claim could only come from the original session it says so.

## What was planned

Two slices. Slice 1 writes an ADR that costs ports against numbers taken from this repo rather than
from the `architecture` skill, and is allowed to conclude *no*. Slice 2 pilots the accepted decision
on exactly one service, `AnimeService`, and settles the question the ADR could not: **how many
ports** — one per repository, or one aggregate per service.

## What is actually true

The ADR landed at `ba917b9` (241 lines), was accepted, and the pilot landed at `3244116`.

| | before | after | today (2026-09-04) |
|---|---|---|---|
| `pnpm test` | 64 files / 351 tests | 65 / 355 | **65 / 355 passing** |
| `pnpm typecheck` | clean | clean | **clean** |
| services taking ports | 0 of 12 | 1 of 12 | 1 of 12 |

Two ports, not five and not twelve: `CatalogSource` (one method) and `CatalogStore` (four members,
grouped). Neither signature carries `D1Database`, `D1Result` or `D1PreparedStatement`.

## The mistakes, in the order they were made

1. **The slice-2 `Done when` chain was joined with `;` instead of `&&`.** The grep chain
   short-circuits on the very line it is supposed to catch, and `pnpm typecheck && pnpm test` then
   ran anyway — so an **untouched repo printed the same last line as a finished one**
   (`Tests  351 passed (351)`). A gate that passes on the unmodified repo is not a gate.
2. **The slice-1 gate asserted its section count with `grep -c`, which exits zero on `3` as well as
   on `4`.** A draft ADR missing `## Consequences` passed by inspection.
3. **The gate greps text, not code.** A comment in `anime.service.ts` quoting the old
   `new MalClient(config)` line was enough to fail the gate on a file that was already correct.
   This is the one that cost a debug cycle.
4. **The ADR costed the store port as "one interface carrying the 28 public methods"** — which read
   literally means flat, and flat collides: `get` and `put` mean four different things in this
   codebase.

## What worked

- **Costing the decision against this repo's own numbers.** The ADR named 15 files in
  `src/services/`, 12 in `src/repositories/` and 11 factory functions in `src/app.ts` — plus the two
  callsites the factories miss. An option costed as "significant refactor" would have failed slice 1
  on purpose.
- **Being explicit that ports buy uniformity, not testability.** Eleven of the twelve services
  already took an optional `source?: MalClient` so tests could pass a fake. Ports made that uniform;
  claiming they made it possible would have been false.
- **The stop condition was checked first rather than last**, as the ADR asked. The place it was in
  real doubt was `refreshLeases.acquire`: an adapter that hands `D1Result` back for the caller to
  interpret is the driver with an interface in front of it. It answers `boolean`.
- **The tripwire was verified rather than asserted.** Temporarily retyping that return as
  `Promise<D1Result>` produced 16 compile errors — one of them inside the new
  `tests/services/anime-service-ports.test.ts` — and the change was reverted. That is the evidence
  the new test is a tripwire and not decoration. *(From the slice-2 record; not re-run today.)*
- **Every touched test file kept its exact `it()` count**, checked against `b28d066` file by file,
  because the failure mode here is a deleted test reading as a passing one.

## What did not

**The pilot diverged from the ADR in three places, and all three were the ADR being wrong:**

| the ADR said | what shipped | why |
|---|---|---|
| the store port is one flat interface | four grouped members | flat collides on `get`/`put`; renaming them (`readAnime`, `readCatalogList`) rewrites `withCache` and all twelve services — inside a *pilot* |
| the repositories declare `implements` | only `D1CatalogStore` does | `implements CatalogStore['cacheEntries']` is not legal TypeScript, and exporting an alias per member puts the rejected twelve-interface shape back on the port's surface by another route |
| retype the optional `source?` | delete it | a dependency defaulting to a real adapter is a composition root hiding in a constructor |

The grouping is also what kept this a pilot: `CacheDeps` projects the two members `withCache` needs
straight out of the port type, so the eleven services that still build their own repositories
satisfy it **structurally** and did not have to change.

## What changed so it cannot recur

| was | is now |
|---|---|
| a `Done when` chain joined with `;` — passes on an untouched repo | joined with `&&`; run on an untouched repo it prints nothing |
| `grep -c` on the ADR's section headings, green at 3 of 4 | the count is asserted `= 4` |
| the gate hard-coded `docs/architecture/`, failing the ADR's own alternative folder | it looks the file up in both allowed folders |
| a gate matching adapter class names anywhere in the file, comments included | `anime.service.ts` carries no adapter class name at all — written into slice 3 as the shape the siblings should end in |
| the port's conformance asserted by reading it | asserted by breaking a signature, counting the compile errors, reverting |
| two slices closed with no record outside their own plan files | `docs/postmortem/` exists, and this is its first entry |

## Still open

- **Eleven of the twelve services construct their own adapters.** Ten take a raw `D1Database` and
  import `../repositories/*` and `mal-client` directly; `RandomService` has no factory at all —
  `src/app.ts:538` and `:548` call `new RandomService(c.env.DB)` inline. Tracked as
  [slice 3](../plans/dependency-injection/slice-03-roll-out-remaining-services.md).
- **`SourceResult` and `FetchBudget` still live in `src/source/`**, so `CatalogSource` imports from
  its own adapter's directory — the port points outward. `CacheEntry` was moved into
  `catalog-store.port.ts` for exactly this reason; these two were left because `fetch-policy.ts`
  holds real policy alongside the type.

---

Superseded as the epic record by [[ports-and-injection]] (`docs/postmortem/`), which closes all three slices. This one covers slices 1 and 2 only, written the day they shipped.
