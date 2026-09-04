---
status: done
kanban: 69daa358-7a8e-4b26-84e2-150e3e7b7f93
---

# Slice 2 — Pilot: ports and injection for AnimeService

**Blocked on the owner accepting or rejecting the ADR from slice 1.** Whether this repo takes ports
at all is a call about how much rewrite a one-person project should absorb for a rule it can
otherwise document its way out of. Nobody but the owner can make it, and the board will not carry
this reason — it is here because a blocked card keeps its column and says nothing.

## Delivers

`AnimeService` receives its collaborators instead of building them. `src/app.ts` builds them.

Today `src/services/anime.service.ts:60` constructs five adapters — `CacheRepository`,
`RefreshLockRepository`, `AnimeRepository`, `CatalogListRepository`, `MalClient` — from a raw
`D1Database` and a `RuntimeConfig`. After this slice the constructor takes ports and
`src/app.ts:112` (`animeService()`) does the constructing.

## Needs

- Slice 1's ADR accepted. If it is rejected this slice does not happen.
- A decision the ADR should already have made: how many ports. One per repository (five interfaces)
  or one aggregate per service. The pilot is where this gets settled by doing it once, so do not
  start the rollout until this slice has an answer.
- `background(c)` at the `waitUntil` callsite in `src/app.ts:112` already crosses the boundary
  correctly — it is a function passed in. Use it as the shape the ports should match.

## Tests

- `pnpm test` stays at 351 passing. The service tests currently pass a fake through the optional
  `source?` parameter; after this slice they pass fakes through the ports instead. Rewriting those
  call sites is part of the slice, not follow-up work.
- One new test: `AnimeService` constructed with fakes for all five collaborators and no `D1Database`
  in sight. That test failing to compile is the signal the port is still leaking the driver type.
- The suite is 64 files / 351 tests before this slice. If the count drops, a test was deleted rather
  than adapted.

## Done when

```bash
! grep -qE "new (CacheRepository|RefreshLockRepository|AnimeRepository|CatalogListRepository|MalClient)\(" src/services/anime.service.ts && ! grep -q "D1Database" src/services/anime.service.ts && echo "anime.service.ts: no adapter construction, no D1Database" && pnpm typecheck && pnpm test
```

The marker line prints, `tsc --noEmit` prints nothing, and the run ends with at least
`Tests  351 passed`.

The `;` in the earlier form was the defect: the grep chain short-circuits on
`src/services/anime.service.ts:60`, and `pnpm typecheck && pnpm test` then ran anyway and ended on
`Tests  351 passed (351)` — an untouched repo printing the same last line as a finished one. Run
today, the whole block prints nothing.

## If stuck

If the port ends up with `D1Database` or a `D1Result` in its signature, it is not a port — it is the
driver with an interface in front of it. Stop, and write the finding into the ADR as evidence
against the change rather than shipping a decorative abstraction.

## Outcome

Shipped 2026-09-03, after the owner accepted the ADR. `AnimeService` receives its collaborators and
constructs nothing; `src/app.ts:117` builds them.

**Suite: 64 files / 351 tests before, 65 / 355 after.** The four added are the new port test. Every
test file this slice touched kept its exact `it()` count — checked against `b28d066` file by file,
because the failure mode here is a deleted test reading as a passing one. The integration project
(`pnpm test:integration`, not included in `pnpm test`) stayed at 6 files / 29 tests.

`Done when` block: exit 0. Marker line printed, `tsc --noEmit` silent, run ended
`Tests  355 passed (355)`.

### The port count, settled

Two, as the ADR said. One interface each, no D1 type in either signature:

```ts
export interface CatalogSource {
  getHtml(url: string, requiredMarkers?: string[], budget?: Partial<FetchBudget>): Promise<SourceResult<string>>;
}

export interface CatalogStore {
  readonly cacheEntries: {
    get(resourceKey: string): Promise<CacheEntry | null>;
    put(entry: CacheEntry): Promise<void>;
    isFresh(entry: CacheEntry, now?: Date): boolean;
  };
  readonly refreshLeases: {
    acquire(resourceKey: string, owner: string, leaseSeconds?: number): Promise<boolean>;
    release(resourceKey: string, owner: string): Promise<void>;
  };
  readonly anime: {
    get(malId: number): Promise<AnimeDetail | null>;
    put(detail: AnimeDetail, fetchedAt: string, version: string): Promise<void>;
  };
  readonly catalogLists: {
    get<T>(resourceKey: string): Promise<T | null>;
    put<T>(resourceKey: string, payload: T, fetchedAt: string, version: string): Promise<void>;
  };
}
```

### Where this diverged from the ADR, and why

**The store port groups its methods into members instead of flattening them.** The ADR costed the
store as "one interface carrying the 28 public methods", which read literally means flat. Flat
collides: `get` and `put` mean four different things here. The ways out were renamed methods
(`readAnime`, `readCatalogList`, …), which rewrites `withCache` and all twelve services in the
pilot, or nested members, which rewrites none of them. Nested won. Still one port, same methods,
grouped by the sub-conversation each belongs to — and `CacheDeps` now projects the two members
`withCache` needs straight out of the port type, so the eleven services that still build their own
repositories satisfy it structurally and did not have to change. That projection is what kept this a
pilot instead of the whole rollout.

**The `implements` clause landed on the adapter, not on the repositories.** The ADR expected the
repository files to declare themselves implementations. `implements CatalogStore['cacheEntries']` is
not legal TypeScript — the clause takes an identifier, not an indexed access type — and exporting a
named alias per member to satisfy it would put four more interfaces on the port's public surface,
which is the twelve-interface shape the ADR rejected arriving by another route. `D1CatalogStore
implements CatalogStore` is the single conformance point. Drift still fails to compile; it fails at
the adapter, naming the member that no longer fits.

**The optional `source?` parameter is gone from `AnimeService`, not just retyped.** A dependency that
defaults to a real adapter is a composition root hiding in a constructor. The other ten keep theirs
until slice 3.

### The stop condition did not trigger

Checked first rather than last, as the ADR asked. No port signature carries `D1Database`, `D1Result`
or `D1PreparedStatement`. The place it was in real doubt was `refreshLeases.acquire`: the adapter
decides from `result.meta.changes`, and a port handing the `D1Result` back for the caller to
interpret would have been the driver with an interface in front of it. It answers `boolean` instead.

Verified rather than asserted: temporarily changing that return type to `Promise<D1Result>` produced
16 compile errors, including one inside `tests/services/anime-service-ports.test.ts`, then the change
was reverted. So the new test genuinely is the tripwire the slice asked for and not decoration.

### Note for slice 3

The `Done when` grep matches text, not code. A comment in `anime.service.ts` quoting the old
`new MalClient(config)` line was enough to fail the gate on a file that was already correct — cost a
debug cycle. `anime.service.ts` now carries no adapter-class name at all, comments included; the
sibling services should end the same way.
