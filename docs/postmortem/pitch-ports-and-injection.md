---
status: closed
epic: di
---

> **Closed 2026-09-04.** Moved here from `docs/pitches/` so the pair reads as one thing: this is what
> was promised, [[ports-and-injection]] is what happened.

# Ports for D1 and MAL, and a composition root that builds them

## The problem

The `architecture` skill states two rules this repo breaks in the same line of code:

1. a driven dependency earns a port from its first use;
2. only the composition root constructs adapters.

`src/services/anime.service.ts:56` is the whole case:

```ts
constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient, waitUntil?: WaitUntil) {
  this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.deps = { cache: this.cache, locks: this.locks, waitUntil }; this.anime = new AnimeRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
}
```

Five adapters built inside a service, from a raw `D1Database` handle the service should never have
seen. `MalClient` is half-injected — the `source?` parameter exists so tests can pass a fake — which
shows the shape was already felt and only applied where a test forced it.

There are 15 files in `src/services/` and 12 in `src/repositories/`. This is not a small change.

## Why it might not be worth it

The cost is real and the benefit is partly already banked. The service tests pass fakes today
through the optional-parameter trick, so a port would not unlock testing that is currently
impossible — it would make it uniform instead of ad hoc. And the only realistic second adapter for
D1 is another SQLite, which the Workers runtime does not offer.

So this epic starts with a decision, not with code. The first slice writes the ADR that costs both
options honestly; the owner decides. If the answer is "no", the ADR is the deliverable and the rest
of the epic is closed — a recorded "we looked and chose not to" is worth more than a silent gap
between the skill and the repo.

## Shape if the answer is yes

A pilot on one service first — `AnimeService`, because it is the worst offender and touches both
kinds of dependency — then the same move rolled across the rest. Not a big-bang rewrite: every
slice ends with `pnpm test` green.
