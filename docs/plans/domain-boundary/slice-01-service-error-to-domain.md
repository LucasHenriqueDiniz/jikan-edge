---
status: todo
kanban: 37283d4b-c158-47c0-bb28-903835e4326c
---

# Slice 1 — Move ServiceError into the domain

## Delivers

`src/domain/` compiles with no import that points at `src/services/`. Today
`src/domain/pagination.ts:1` is the one file that does, and it is the only arrow out of the domain in
the whole tree.

## Needs

- Nothing new. `src/services/cacheable.ts:10-14` already declares `ServiceErrorStatus` and
  `ServiceError` in isolation from the caching helpers around them; the move is a cut and paste plus
  a re-export.
- 15 files under `src/` and 4 under `tests/` reference `ServiceError` by name
  (`grep -rlw ServiceError src tests`). None of them change in this slice — `src/services/cacheable.ts`
  re-exports both names so every existing import path keeps resolving.

## Tests

- The existing suite is the test. No behaviour changes, so any failure is a real regression, not a
  test that needs updating.
- `tests/domain/pagination.test.ts` and `tests/http/errors.test.ts` both construct or catch
  `ServiceError`; they exercise the moved class through its new home without being edited.
- Add nothing. A test asserting "the class is in this file" tests the filesystem, not the code.

## Done when

```bash
! grep -rq "\.\./services/" src/domain/ && pnpm typecheck && pnpm test
```

The grep prints nothing and does not short-circuit the chain, `tsc --noEmit` prints nothing, and the
run ends with `Tests  351 passed (351)`.

## If stuck

If the re-export in `src/services/cacheable.ts` creates an import cycle — `cacheable` importing
`domain/errors` while something in `domain/` imports `cacheable` — drop the re-export and update the
15 call sites in the same commit instead. It is a mechanical find-and-replace and the cycle is not
worth working around.
