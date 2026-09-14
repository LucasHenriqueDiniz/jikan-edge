---
tags:
  - pitch
  - search
  - bugfix
  - mal-client
status: active
kanban:
---

# Pitch — Search returns `UPSTREAM_SUSPICIOUS` on an exact title match

## Problem

A real consumer ([issue #16](https://github.com/LucasHenriqueDiniz/jikan-edge/issues/16))
searched anime with the full title and got a 502:

```
GET /v1/anime?q=Lv999+no+Murabito&order_by=start_date&sort=desc
→ {"error":{"code":"UPSTREAM_SUSPICIOUS","message":"Unable to refresh this resource."}}
```

Dropping part of the title makes the same search work and returns the title they were after:

```
GET /v1/anime?q=Lv999&order_by=start_date&sort=desc
→ {"data":[{"malId":62322,"url":".../anime/62322/Lv999_no_Murabito", ...}]}
```

So the entry exists and is reachable — searching for it by its **exact** name is what fails.
For a consumer this is the worst shape of failure: the more precisely they ask, the more
likely they are to hit a 502, and nothing about the query looks wrong.

## Root cause (confirmed via `wrangler dev --remote`, 2026-09-14)

The probe **corrected** the first hypothesis. It is not "exact title always redirects" — the
trigger is an **exact-title match combined with an `order_by` filter**, seen from Cloudflare's
network:

| Query (through the Worker on `--remote`) | Result |
|---|---|
| `q=Lv999+no+Murabito&order_by=start_date&sort=desc` | **502 UPSTREAM_SUSPICIOUS** |
| `q=Lv999+no+Murabito&order_by=start_date` (order alone) | **502** |
| `q=Lv999+no+Murabito` (exact, no order) | **200**, one entry |
| `q=Lv999&order_by=start_date&sort=desc` (partial + order) | **200**, results |

`order_by=start_date` maps to `o=2`, `sort=desc` to `w=1`
([search.service.ts:38](../../src/services/search.service.ts)), so MAL receives
`anime.php?q=Lv999 no Murabito&cat=anime&o=2&w=1`. Probing MAL directly:

```
anime.php?q=Lv999 no Murabito&cat=anime&o=2&w=1  -> 303  Location: /anime/62322/Lv999_no_Murabito
anime.php?q=Lv999 no Murabito&cat=anime          -> 303  Location: /anime/62322/Lv999_no_Murabito
anime.php?q=Lv999&cat=anime&o=2&w=1              -> 200  (results page)
```

MAL 303-redirects an exact-title search to the entity's detail page. `MalClient.attempt` follows
the redirect because the target is still on the allowed host
([mal-client.ts:53](../../src/source/mal-client.ts)), fetches the detail page, and the
required-marker guard fails — the detail page's `<title>` is not `Search Anime - MyAnimeList.net`
([search.service.ts:155](../../src/services/search.service.ts)) so `classifyHtml` returns
`required_structure_missing` -> `suspicious` -> 502. Confirmed it is the *followed redirect*, not
a challenge page: the remote logs show no `source_fetch_failed` (the fetch succeeded) and the 502
is deterministic across repeats.

**The Cloudflare-specific twist** (why the reporter, and this probe, only see it *with*
`order_by`): from Cloudflare's edge the plain exact search (no order) comes back as a **200
results page** and parses fine, while adding `o=`/`w=` makes MAL 303 to the detail page instead.
From an ordinary network *both* variants 303 — so this is the same "MAL answers Cloudflare
differently" class of behavior already on record for the genre taxonomy. The no-order case works
today only by luck of the edge response; the fix should make both robust.

## Solution

Recognize the "search resolved to a single detail page" case and turn it into a **one-entry
result list** (the entity the user searched for), rather than treating the redirect as
suspicious. The redirect `Location` already carries the `malId` and slug. Two viable shapes,
to decide at implementation:

- **Service layer** — when the title search's fetch resolves to a `/anime/:id` / `/manga/:id`
  URL, parse that detail page into the one `SearchEntry` it represents (title, image, type,
  episodes/volumes, score, synopsis). Needs `MalClient` to surface the final redirected URL so
  the service can tell "landed on a detail page" from "landed on a results page".
- **Client layer** — `MalClient` detects a search→detail redirect and returns a typed signal
  instead of the detail HTML under a search marker, so the guard never false-positives.

Either way the guard stays intact for genuinely suspicious responses (challenge pages, wrong
host); only the specific redirect-to-detail case is reinterpreted.

## Architecture

Search flow today: `search.service.search()` → `MalClient.getHtml(searchUrl, [marker])` →
`classifyHtml` (required-marker guard) → `parseAnimeSearchResults`. The redirect is followed
inside `MalClient.attempt` before the service ever sees it. The change touches one of:

- **`MalClient`** — detect that a search URL resolved to a `/anime/:id` or `/manga/:id` detail
  page, and signal that to the caller instead of returning the detail HTML under a search marker.
- **`search.service`** — when the redirect target is a detail page, fetch/parse that single
  entity into a one-item list.
- **`search.parser`** — a code path that reads a detail page into the search entry shape.

Data flow, versions, and cache key (`catalog:search:anime:...`) are unchanged; only the
miss-time refresh behavior changes.

## Schema / Data Changes

None expected to the response contract (still a `SearchEntry[]`, just non-empty where it used to
502). If emitted values for these queries change, bump `ANIME_SEARCH_PARSER_VERSION` /
`MANGA_SEARCH_PARSER_VERSION` so the poisoned cached rows (currently absent, since the miss
never persisted) don't linger — **decide at implementation time**, none is one-way.

## Interfaces / APIs

No new routes. Behavior change only, on existing routes:

| Method | Route / Entry point | Auth | Description |
|--------|---------------------|------|-------------|
| GET | `/v1/anime?q=` | none | Exact-title query returns the matched entry instead of 502 |
| GET | `/v1/manga?q=` | none | Same fix, if manga exhibits the same redirect (to verify) |

## Scope

### In Scope
- [ ] Fix `/v1/anime?q=` returning 502 when the query is an exact title that MAL redirects
- [ ] Confirm and cover the same behavior for `/v1/manga?q=`
- [ ] A fixture + test reproducing the redirect-to-detail case (currently no test exercises it)
- [ ] `CHANGELOG.md` entry (visible bug fix → consumer-facing)

### Out of Scope
- Fixing the empty-list-on-no-match behavior (MAL's own popular-title fallback — documented,
  separate concern)
- Reworking redirect handling in `MalClient` for non-search routes
- `character`/`people` search (different `cat`, "never redirect" per `mal-urls.ts` comment)
- Any change to `order_by`/`sort`/filter validation — those are incidental to this query

## Research Needed
- [x] ~~Confirm the root cause on the real edge.~~ **Done** (2026-09-14, see Root cause above):
  exact-title + `order_by` → MAL 303s to the detail page → `MalClient` follows it → search marker
  absent → 502. The `order_by`-only dependence is a Cloudflare-edge behavior.
- [ ] Does manga (`manga.php?q=`) 303 the same way on an exact title through the edge? (Probe with
  a manga whose exact title matches one entry, with and without `order_by`.)
- [ ] When landed on the detail page, does it carry every `SearchEntry` field the results row
  gives (type, episodes/volumes, score, synopsis), or do some come back null? Decides whether the
  one-entry result is field-complete or partially null vs. a normal search row.
- [ ] Best place to expose the final redirected URL to the service without weakening the guard —
  add it to `SourceResult` success metadata, or a dedicated `redirected_to` signal on `MalClient`?

## Testing Strategy

- **Parser/unit**: a sanitized fixture of the redirect target (detail page) — assert the new
  code path yields a one-entry list with the right `malId`/`title`, not a `ParserError`.
- **Service**: a fake source returning the redirect result — assert the service returns
  `SearchEntry[]` of length 1 instead of throwing `suspicious`.
- **Regression**: keep the existing "no match → popular fallback" and "real multi-row results"
  tests green — the fix must not swallow genuine suspicious responses.
- Follow the repo's fixture rule: capture the real page byte-for-byte and check field by field.

## Success Criteria
- [ ] `GET /v1/anime?q=Lv999+no+Murabito&order_by=start_date&sort=desc` returns the matched
  entry (`malId: 62322`) with a 200
- [ ] `GET /v1/anime?q=Lv999&...` still works (no regression on partial-match searches)
- [ ] A genuinely suspicious upstream (challenge page, wrong host) still yields 502 — the guard
  is narrowed to the detail-redirect case, not disabled
- [ ] Root cause recorded in `docs/routes.md` and a `CHANGELOG.md` entry landed in the fix commit
