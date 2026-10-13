---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://api.tenrai.org/documentation/openapi.json
fetched: 2026-10-11
kind: vendor
---

# Tenrai API OpenAPI document (`info.version` 1.0.20)

> Fetched 2026-10-11 · The competitor's published spec. Read for how it interprets the same Jikan
> parameters, since its behaviour is what the 2026-10-11 paired sweep measured.

## What it says

`/seasons/now`:

- `continuing` — "Include TV series continuing from a previous season when present (flag)",
  enum `["true","false",""]`.
- `kids` — "Filter out kids entries when present (flag)", enum `["true","false",""]`.

`/anime/{id}/reviews`:

- `preliminary` — "Filter preliminary reviews (true = include, false = exclude, only = exclusive)",
  enum `["true","false","only"]`.
- `spoilers` — "Filter spoiler reviews (true = include, false = exclude, only = exclusive)",
  enum `["true","false","only"]`.

The paired sweep measured those defaults: `anime/21/reviews` returned 0 reviews by default and 20
with `?preliminary=true&spoilers=true`, and `seasons/now` returned a total of 120 (no continuing).

## What it does not say

- How `only` is implemented. MAL's toggles have no "only" mode, so it is presumably a filter applied
  after the fetch over Tenrai's own copy. That option is not open to an API that reads one MAL page
  per request.
- What `kids` means in detail. "Filter out" when present is the reverse of Jikan's schedules `kids`
  flag, which *includes* kids entries when present.
