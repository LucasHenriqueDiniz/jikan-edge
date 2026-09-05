---
status: closed
epic: domain
---

> **Closed 2026-09-04.** Moved here from `docs/pitches/` so the pair reads as one thing: this is what
> was promised, [[the-domain-boundary]] is what happened.

# Point every type arrow inwards

## The problem

The hexagon rule this repo follows is that the inside knows nothing about the outside. Two arrows
break it today, and both are cheap to reverse compared to what they cost to keep explaining.

**`ServiceError` lives in the application layer and the domain imports it.**
`src/domain/pagination.ts:1` reads `import { ServiceError } from '../services/cacheable'`. That is
the single arrow pointing out of `src/domain/`, and it exists only because the error class was
written where it was first thrown rather than where it belongs. `src/services/cacheable.ts:10-14`
defines both `ServiceErrorStatus` and `ServiceError` next to a caching helper — two unrelated
concerns in one file.

**Domain types are stranded in the parser layer.** `src/domain/` holds 44 type files. Six type names
still cross out of `src/parsers/` into repositories and services — eight declarations once the two
member types they contain are counted:

| type | declared in | imported by |
| --- | --- | --- |
| `Favorites` (and its member `Favorite`) | `src/parsers/user-favorites.parser.ts:4-5` | `src/repositories/favorites.repository.ts:1`, `src/services/user.service.ts:10` |
| `UserUpdates` (and its member `UserUpdate`) | `src/parsers/user-updates.parser.ts:3-4` | `src/repositories/updates.repository.ts:1`, `src/services/user.service.ts:11` |
| `ClubRelations` | `src/parsers/club-relations.parser.ts:4` | `src/services/club.service.ts:8` |
| `SeasonArchiveEntry` | `src/parsers/season-archive.parser.ts:4` | `src/services/anime.service.ts:34` |
| `ScheduleByDay`, `ScheduleDay` | `src/parsers/schedule.parser.ts:6-7` | `src/services/anime.service.ts:35` |

A repository importing its row type from an HTML parser means the storage layer takes its vocabulary
from the scraping layer. Swap the source and the repositories change for no reason of their own.

## Why now

Both are pure type moves plus re-exports. No behaviour changes, no runtime code moves, and the 351
unit tests are the proof. This is the cheapest structural work in the backlog and it makes the
larger `dependency-injection` epic legible: you cannot argue about which side of a port a type sits
on while the type is in the wrong layer to begin with.

## What this is not

This is not the port extraction. Nothing gains an interface here; types move and the old modules
re-export them so no call site has to change in the same commit that moves a file.
