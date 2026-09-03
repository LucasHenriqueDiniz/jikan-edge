---
status: todo
kanban: c7eddaac-cbad-4503-964f-1f9ec736c7b1
---

# Slice 2 — Move the stranded parser types into the domain

## Delivers

`src/repositories/` stops importing from `src/parsers/` entirely, and the six type names that cross
that boundary today are declared under `src/domain/` like the other 44.

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
! grep -rq "parsers/" src/repositories/ && grep -rlE "^export (interface|type) (Favorites|UserUpdates|ClubRelations|SeasonArchiveEntry|ScheduleByDay|ScheduleDay)\b" src/domain src/parsers && pnpm test
```

Every path the grep lists starts with `src/domain/` and none starts with `src/parsers/`, and the run
ends with `Tests  351 passed (351)`.

## If stuck

If a moved type drags a chain of parser-internal helper types behind it into `src/domain/`, stop and
move only the ones that cross. A domain that has absorbed the parser's private vocabulary is a worse
outcome than the boundary violation this slice was fixing.
