---
status: done
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
! grep -rqE "from '\.\./services/" src/domain/ && echo "src/domain imports nothing from src/services" && pnpm typecheck && pnpm test
```

The grep finds nothing, the marker line prints, `tsc --noEmit` prints nothing, and the run ends with
`Tests  351 passed (351)`.

The pattern is anchored to the `from '../services/` import form deliberately. A bare `services/`
also matches prose, and the re-export this slice leaves in `src/services/cacheable.ts` is exactly
the sort of thing a comment in the moved file would name — which would make the gate unsatisfiable
by the work that satisfies the slice. Today it matches `src/domain/pagination.ts:1` and the block
prints nothing.

## If stuck

If the re-export in `src/services/cacheable.ts` creates an import cycle — `cacheable` importing
`domain/errors` while something in `domain/` imports `cacheable` — drop the re-export and update the
15 call sites in the same commit instead. It is a mechanical find-and-replace and the cycle is not
worth working around.

## Outcome

Shipped 2026-09-04. `src/domain/errors.ts` holds `ServiceError` and `ServiceErrorStatus`;
`src/services/cacheable.ts` re-exports both, so none of the nineteen call sites changed.

`Done when` block: prints `src/domain imports nothing from src/services`, `tsc --noEmit` silent, run
ends `Tests  355 passed (355)`. (355 rather than 351 — the same stale plan number as every other
slice on this board, predating the ports pilot's four tests.) `pnpm test:integration` 29 passed,
`pnpm lint` exit 0.

Checked beyond the gate, since the gate only anchors on one import form: **every `import` in
`src/domain/` now resolves inside `src/domain/`.** Not just no arrow into `src/services/` — no arrow
out of the domain at all.

### The re-export needed an import beside it

`export { ServiceError } from '../domain/errors'` forwards the name without binding it locally, and
`cacheable.ts` throws `ServiceError` itself in four places — `sourceError`, the lease conflict, the
oversized payload. So the module imports it and re-exports the imported binding. `tsc` said so
immediately; the interesting part is that the first form is the one that reads more obviously
correct.

No import cycle, so the `If stuck` branch did not fire: `domain/errors.ts` imports nothing at all,
which is what a domain leaf should look like.

### Why the re-export stayed rather than rewriting nineteen imports

The defect was the *direction* of one import, not where callers should look. `cacheable.ts` is still
a reasonable place to reach `ServiceError` from a service — it is the module those files already
import for `withCache`, `ServiceResponse` and `sourceError`. Rewriting nineteen paths would have
been churn with no reader on the other side of it, and it would have buried the two-line change that
is the actual point of the slice.

### Note on the session this shipped in

A second Claude Code session was writing to this working tree at the same time — `tools/` and
`docs/architecture/diagrams/component-view.excalidraw.md` appeared with timestamps nine minutes
after the previous commit. Nothing of theirs is in any commit here (checked with
`git log --name-only -- tools/`), because this slice was staged by explicit path rather than with
`git add -A`, which every earlier commit in this branch used. **`git add -A` in a shared working tree
commits whatever the other session happens to have half-written.** The repo guide already records
the deploy-side version of this hazard; this is the commit-side one.

---

Closed by [[the-domain-boundary]] (`docs/postmortem/`).
