---
status: done
kanban: c7eddaac-cbad-4503-964f-1f9ec736c7b1
---

# Slice 2 — Move the stranded parser types into the domain

## Delivers

`src/repositories/` stops importing from `src/parsers/` entirely, and the type names that cross out
of `src/parsers/` today are declared under `src/domain/` alongside the 72 exported interfaces
already there (46 files, measured on this tree).

Two of them cross into `src/repositories/` — `Favorites` in `favorites.repository.ts:1` and
`UserUpdates` in `updates.repository.ts:1`. The other four cross into `src/services/`, which is a
legal direction; they move with the first two because leaving half the parser's public vocabulary
behind is what makes the next audit raise this again.

Moving: `Favorites` and `Favorite` (`src/parsers/user-favorites.parser.ts:4-5`), `UserUpdates` and
`UserUpdate` (`src/parsers/user-updates.parser.ts:3-4`), `ClubRelations`
(`src/parsers/club-relations.parser.ts:4`), `SeasonArchiveEntry`
(`src/parsers/season-archive.parser.ts:4`), `ScheduleByDay` and `ScheduleDay`
(`src/parsers/schedule.parser.ts:6-7`).

Staying put: `ListLayout`, `ListParseResult`, `SeasonParseResult`, `ListCompletenessEvidence`,
`SeasonCompletenessEvidence`. Measured — no file outside `src/parsers/` names any of them. They are
parser-internal vocabulary and belong where they are.

## Needs

- Slice 1 merged. Not a hard dependency, but both slices touch the same layer and reviewing one
  type-move diff at a time is the point.
- `ScheduleDay` is derived from the `SCHEDULE_DAYS` const in `src/parsers/schedule.parser.ts:6`
  (`(typeof SCHEDULE_DAYS)[number]`), and `src/services/anime.service.ts:35` imports the const too.
  Decide in this slice whether `SCHEDULE_DAYS` moves with the type or the type is spelled out in the
  domain. Moving the const is the smaller change; spelling it out breaks the link that keeps them
  honest.

## Tests

- Existing suite only, same reasoning as slice 1: type moves plus re-exports change no behaviour.
- The parser modules keep re-exporting each moved type, so parser tests are untouched.
- If a parser test starts failing, the move changed a structural type by accident — read the diff
  rather than adjusting the test.

## Done when

```bash
NAMES='(Favorites|Favorite|UserUpdates|UserUpdate|ClubRelations|SeasonArchiveEntry|ScheduleByDay|ScheduleDay)'
! grep -rqE "from '\.\./parsers/" src/repositories/ && ! grep -rqE "^export (interface|type) $NAMES\b" src/parsers/ && grep -rlE "^export (interface|type) $NAMES\b" src/domain/ && pnpm test
```

The first two greps find nothing, the third lists the files under `src/domain/` that now declare the
moved names, and the run ends with `Tests  351 passed (351)`.

Asserting the absence from `src/parsers/` separately is what makes this a gate: the earlier form
listed `src/domain src/parsers` in one `grep -rl` and left the reader to notice that no path started
with `src/parsers/`. The re-exports this slice leaves behind
(`export type { Favorites } from '../domain/user-favorites'`) do not match a declaration pattern, so
they neither satisfy nor break it. Today the first grep matches
`src/repositories/favorites.repository.ts:1` and `src/repositories/updates.repository.ts:1`, and the
block prints nothing.

## If stuck

If a moved type drags a chain of parser-internal helper types behind it into `src/domain/`, stop and
move only the ones that cross. A domain that has absorbed the parser's private vocabulary is a worse
outcome than the boundary violation this slice was fixing.

## Outcome

Shipped 2026-09-04. Eight names in five new files under `src/domain/`; `src/repositories/` imports
nothing from `src/parsers/`.

`Done when` block, verbatim: the first two greps print nothing, the third lists
`user-favorites.ts`, `user-updates.ts`, `club-relations.ts`, `season-archive.ts` and `schedule.ts`,
and the run ends `Tests  355 passed (355)` (the same stale 351 in the plan as everywhere else on
this board). `pnpm test:integration` 29 passed, `pnpm lint` and `pnpm typecheck` clean.

### `SCHEDULE_DAYS` moved with its type

The `Needs` section left this open: move the const, or spell the union out in the domain. **The const
moved.** Spelling it out would have broken the link that keeps the two honest — the parser iterates
`SCHEDULE_DAYS` to build the object and `query-contract.ts` validates `?filter=` against it, so a day
added to one and not the other would have compiled. It is the smaller change *and* the safer one,
which is not the trade-off the plan expected to find.

### The re-exports are the reason this is a small diff

Every parser re-exports what it used to declare, so the services that read these types from the
parser layer — a legal direction, unlike the repositories — did not change. Same reasoning as slice
1's re-export in `cacheable.ts`: the defect was that `src/repositories/` reached *into* `src/parsers/`,
not that every caller was importing from the wrong place.

`schedule.parser.ts` re-exports a **value** as well as types (`export { SCHEDULE_DAYS, type … }`),
because `SCHEDULE_DAYS` is a runtime const the parser itself iterates.

### The "staying put" list was re-measured, not trusted

The plan named five parser-internal types to leave alone, on a measurement taken when it was written.
Re-checked on the finished tree: nothing outside `src/parsers/` names `ListLayout`,
`ListParseResult`, `SeasonParseResult`, `ListCompletenessEvidence` or `SeasonCompletenessEvidence`.
The `If stuck` branch — a moved type dragging parser-internal helpers into the domain — never had a
chance to fire, because none of the eight carries one.

### One stale comment, caught by moving the thing it described

`catalog-store.port.ts` opened with a comment saying `Favorites` and `UserUpdates` "still live in
`src/parsers/` — the domain-boundary pitch is what moves them". Written three commits earlier by this
same board's DI slice, and false the moment this one landed. Deleted with the move rather than left
for an audit. It is the fourth time this session that shipping a change falsified prose written
beside it.

---

Closed by [[the-domain-boundary]] (`docs/postmortem/`).
