---
status: done
kanban: 1287c82e-42b1-4d1e-a261-50ca5fed4c18
---

# Slice 3 — Roll the pilot across the remaining services

## Delivers

No service constructs an adapter. All construction happens in the eleven factory functions at
`src/app.ts:111-121`, and no service constructor mentions `D1Database`.

11 files in `src/services/` still name `D1Database` once slice 2 has converted
`anime.service.ts`, and all of them follow the shape it settled: ten that build their own
repositories and `MalClient`, plus `random.service.ts`, which builds nothing but takes a raw
`D1Database` straight into `this.db.prepare(...)`.

`RandomService` is also the one service with no factory — `src/app.ts:530` and `:540` do
`new RandomService(c.env.DB)` inline inside the two random route handlers. Giving it a factory
alongside the other eleven is part of this slice, not a detail: without that, `src/services/`
cannot stop naming `D1Database`.

## Needs

- Slice 2 merged and its port shape unchanged for at least one other service. If the second service
  needs a different shape, the pilot did not settle anything and this slice is premature.
- A note on ordering: `src/services/cacheable.ts` is shared by every service through `CacheDeps`, so
  change it once and let the rest follow rather than per-service.

## Tests

- `pnpm test` at 351 or above throughout — this slice can be split per service and each split ends
  green. If a service cannot be converted with the suite green, it is the one that disproves the
  port shape; stop there.
- `pnpm test:integration` runs too, once at the end. The unit suite uses fakes and would not notice
  a wiring mistake in `src/app.ts`.
- No new tests beyond the per-service construction test slice 2 established.

## Done when

```bash
! grep -rqE "new [A-Za-z]*Repository\(|new MalClient\(" src/services/ && ! grep -rq "D1Database" src/services/ && ! grep -qE "new [A-Za-z]+Service\(c\.env\.DB" src/app.ts && echo "no service builds an adapter; none is handed a raw D1" && pnpm typecheck && pnpm test
```

All three greps find nothing, the marker line prints, `tsc --noEmit` prints nothing, and the run
ends with at least `Tests  351 passed`.

The third grep is what keeps the composition root in scope. It matches 13 sites today — the eleven
factories and the two inline `new RandomService(c.env.DB)` calls — so it cannot be satisfied by
rewriting the factories and leaving the random routes alone, which is the state the first two greps
would happily accept. Today the block stops at the first grep and prints nothing.

## If stuck

If this stalls halfway — some services converted, some not — that is a shippable state, not a
failure. Leave the converted ones converted, set this slice back to `todo` with a note listing which
services remain, and do not revert. A partially applied convention that is written down beats a
revert that loses the work.

## Outcome

Shipped 2026-09-04. All twelve services take `(store, source, config, waitUntil?)`, none constructs
an adapter, and `src/services/` does not name the binding type anywhere.

`Done when` block, verbatim: prints `no service builds an adapter; none is handed a raw D1`,
`tsc --noEmit` silent, run ends `Tests  355 passed (355)`. `pnpm test:integration` 29 passed,
`pnpm lint` exit 0.

### The pilot's shape held, and that was the precondition

The `Needs` section said this slice is premature if the second service needs a different shape. It
did not. Ten of the eleven converted to the identical constructor with only the member names
differing, which is why the conversion was scripted rather than typed eleven times.

### What the port grew

Nine members. Six resources store one payload per MyAnimeList id and nothing else, so they are one
generic `DetailStore<T>` rather than six hand-written members differing only in a type argument —
the first draft wrote them out and added sixty lines a reader has to compare character by character
to see are the same conversation. `favorites` and `updates` are the username-keyed equivalent,
`KeyedStore<T>`.

**`users` stayed bespoke on purpose.** It reads and writes two payloads at once (profile plus
statistics) and its list is a collection rather than a payload; forcing it into `KeyedStore` would
have meant renaming its methods to fit a shape it does not have — the same argument that made the
store port nested rather than flat in slice 2.

### `RandomService` was the whole reason this slice could not be done by halves

It was the one service that took a raw binding and wrote SQL against it, which is also why it was
the only one with no factory: the two route handlers built it inline. So `src/services/` could not
stop naming the binding type until it had a repository, and the composition root could not own all
construction until it had a factory. Both landed here:

- `RandomRepository` holds the `ORDER BY RANDOM()` statements and the kind → table map. The map is
  what makes the table-name interpolation safe — `RandomKind` is a closed union, so no caller string
  reaches the statement.
- `RandomKind` moved to `src/domain/random.ts`. It used to be derived from the service's own table
  map (`keyof typeof TABLES`), which would have made the port import a service to name its own
  argument type.
- **Policy stayed in the service.** The repository answers `null` on an empty table; deciding that
  an empty local catalog is a 404 `NO_LOCAL_ENTRIES` is a service decision and did not move.

### Two things the compiler and the gate caught that review would not have

**`private readonly cache` was dead in seven of the ten services.** The generated constructors kept
it out of symmetry with `AnimeService`, but only `anime`, `person` and `producer` ever read
`this.cache` — the rest used it once, to build `deps`, which now reads `store.cacheEntries`
directly. Biome deleted the seven declarations and `tsc` then failed on the orphaned assignments.
Neither would have looked wrong in a diff.

⚠️ **The gate failed twice on comments, and the second time was the comment about the first.**
`Done when` greps `src/services/` for the binding type and for adapter constructors, and a text
match cannot tell a comment from code. The first failure was a sentence explaining what
`RandomService` used to take. The fix was a comment explaining the trap — which quoted the two names
it was warning about and failed the same gate. Slice 2 had already written this down as a note for
slice 3, from the other direction, and it still took two rounds. **A prose gate constrains the prose
too.**

### Test call sites

Six files. The three integration suites pass `new D1CatalogStore(bindings.DB)`, which is the real
adapter over a real D1 — the wiring stays exercised. The three search unit tests pass the same
adapter over their existing fake binding, so the fake keeps working and the test still checks what it
was written to check (a 502 mapping), not storage.

`anime-service-ports.test.ts`'s in-memory store gained the nine new members as a `Proxy` whose every
method throws. Answering `null` or `{}` would have been easier and wrong: `AnimeService` reads none
of them, and a permissive fake means a service quietly starting to depend on one goes green instead
of saying it changed what it needs.
