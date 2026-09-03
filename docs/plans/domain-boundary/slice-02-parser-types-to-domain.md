---
status: todo
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
