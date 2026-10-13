---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://jikan.lucashdo.com/v1/
fetched: 2026-10-11
kind: primary
---

# This API in production, the same day

> Fetched 2026-10-11 · Measured against production to confirm that what the window audit predicts is
> what consumers get, and to re-check two claims the repo's own docs make.

## What it says

**Anime synopsis** (window 90 KB, synopsis ends past it on all three large pages):

| route | `synopsis` | `background` | `meta.fetchedAt` |
| --- | --- | ---: | --- |
| `/v1/anime/21` | **null** | 1,475 chars | 2026-10-11T14:28:29Z |
| `/v1/anime/235` | **null** | 429 chars | 2026-10-11T14:28:34Z |
| `/v1/anime/1735` | **null** | null | 2026-10-11T15:24:12Z |
| `/v1/anime/1` | 1,030 chars | 1,040 chars | 2026-10-11T16:32:24Z |
| `/v1/anime/5114` | 1,163 chars | null | 2026-10-11T17:20:00Z |

**Character detail** (window 60 KB):

| route | `nameKanji` | `favorites` | `about` length |
| --- | --- | ---: | ---: |
| `/v1/characters/40` | null | null | 0 |
| `/v1/characters/417` | null | null | 0 |
| `/v1/characters/62` | null | null | 0 |
| `/v1/characters/1` | `スパイク・スピーゲル` | 49,407 | 1,873 |
| `/v1/characters/17` | null | null | 0 |
| `/v1/characters/246` | null | null | 0 |

That is five of six null, matching the five pages whose fields sit past 60 KB in `mal-character-detail.md`.

**`/v1/clubs/99999999`** answers `404 {"error":{"code":"NOT_FOUND",…}}`. `.claude/CLAUDE.md` still lists
"a nonexistent club … currently becomes a 500 `UPSTREAM_SUSPICIOUS`" as a known follow-up. Today it
does not.

**`/v1/seasons/now`** returned 165 entries (`meta.fetchedAt` 2026-10-11T17:22:17Z), the same 165 ids as
MAL's page.

## What it does not say

- How long these have been wrong. The cached rows carry today's `fetchedAt`, so they were rebuilt
  today and still came out null. They are not stale leftovers.
