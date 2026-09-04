---
tags:
  - postmortem
  - kind/plan
  - area/architecture
  - domain
  - layering
  - stale-claims
closed: 2026-09-04
---

# The two arrows out of the domain

> Closed 2026-09-04 · jikan-edge@7f7b7f2 · plans: [[slice-01-service-error-to-domain]], [[slice-02-parser-types-to-domain]] · pitch: [[pitch-the-domain-boundary]] · follows [[ports-and-injection]]

## What was planned

Two type moves. `ServiceError` out of `src/services/cacheable.ts` and into the domain, because
`src/domain/pagination.ts` imported it — the one arrow in the tree pointing outward. Then the eight
domain-shaped names stranded in `src/parsers/`, two of which `src/repositories/` reached in for.

## What is actually true

| | before | after |
|---|---|---|
| imports in `src/domain/` resolving outside `src/domain/` | 1 | **0** |
| `src/repositories/` importing from `src/parsers/` | 2 files | 0 |
| domain-shaped types declared in `src/parsers/` | 8 | 0 |
| call sites that had to change | — | **none** |
| tests | 355 unit / 29 integration | unchanged, all passing |

Two commits, 9+/17− and 14 files. The whole epic is smaller than the postmortem describing it, which
is the correct proportion for a boundary fix that was always two type moves and never a redesign.

## What worked

**Re-exports, in both slices, for the same reason.** `cacheable.ts` re-exports `ServiceError`; the
five parsers re-export what they used to declare. The defect in each case was the *direction* of a
specific import — the domain reaching into the application layer, the repositories reaching into the
parser layer — not that every caller was importing from the wrong place. Rewriting nineteen paths in
slice 1 and a dozen more in slice 2 would have buried the two-line change that is the actual point
under a diff nobody reads.

**The gates were written to survive the work that satisfies them.** Slice 1 anchors on
`from '../services/` rather than a bare `services/`, and the plan says why: the re-export it leaves
behind is exactly the sort of thing a comment would name, and a looser pattern would have made the
gate unsatisfiable by its own solution. Slice 2 asserts the *absence* from `src/parsers/` as its own
clause instead of listing two directories in one `grep -rl` and leaving the reader to notice which
paths came back. Both are the lesson the hygiene and DI boards paid for twice — a gate that greps
text cannot tell a comment from code — applied *before* the work rather than after.

**Re-measuring the plan's own measurements.** Slice 2 named five parser-internal types to leave
alone, on a count taken when it was written. Re-checked on the finished tree: still nothing outside
`src/parsers/` names them. The check cost one command; trusting it would have cost nothing until it
was wrong.

## What did not

**`export … from` does not bind the name locally**, and `cacheable.ts` throws `ServiceError` in four
places of its own. The form that omits the import is the one that reads more obviously correct. `tsc`
said so in a second, which is the argument for the typecheck being in the gate rather than after it.

**A comment three commits old was already false.** `catalog-store.port.ts` opened with "`Favorites`
and `UserUpdates` are domain shapes that still live in `src/parsers/` — the domain-boundary pitch is
what moves them." Written by this same board's DI slice, and untrue the moment this one landed. It is
the fourth time in one session that shipping a change falsified prose sitting beside it; every time,
the fix was cheap because it was done in the same commit.

**A second Claude Code session was writing to this working tree throughout.** `tools/` and
`docs/architecture/diagrams/component-view.excalidraw.md` appeared with timestamps nine minutes after
a commit. Nothing of theirs was swept in — but only because staging switched to explicit paths at
that point. **The thirteen commits before it used `git add -A`**, and would have committed whatever
the other session had half-written. The repo guide already records the deploy-side version of this
hazard, from 2026-07-30, when one session published another's uncommitted work and a third undid it.
This is the commit-side version of the same thing.

## What changed so it cannot recur

| was | is now |
|---|---|
| `src/domain/pagination.ts` importing from `src/services/` | every import in `src/domain/` resolves inside `src/domain/` |
| `FavoritesRepository`/`UpdatesRepository` importing from `src/parsers/` | `src/repositories/` imports nothing from the parser layer |
| eight domain shapes declared in parser files | declared in `src/domain/`, re-exported where they were |
| `ScheduleDay` derived from a const in the parser, with `?filter=` validated against that same const from two layers away | both live in `src/domain/schedule.ts`, so a day added to one and not the other cannot compile |
| `git add -A` in a working tree another session is writing to | staging by explicit path, and this record saying why |

## Still open

- **`SourceResult` and `FetchBudget` still live in `src/source/`**, so `CatalogSource` imports from
  its own adapter's directory. Inherited from [[ports-and-injection]] and untouched here: the fix is
  splitting `fetch-policy.ts`, which holds real policy alongside the type, and that is its own slice.
- **No dead-code tool.** Inherited from [[linter-formatter-and-app-ts]]. Biome's
  `noUnusedPrivateClassMembers` only sees inside a class; a type re-exported by a parser that nothing
  imports from there any more would go on looking used — which is now a slightly larger surface than
  it was this morning.
