---
status: blocked
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
