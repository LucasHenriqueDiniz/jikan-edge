---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json
fetched: 2026-10-11
kind: primary
---

# Jikan REST API OpenAPI document (`info.version` 4.0.0)

> Fetched 2026-10-11 · Jikan's own OpenAPI file from its repository. Read for the documented
> semantics of `continuing`, `preliminary` and `spoilers`, the parameters a consumer porting from Jikan
> will send. `api.jikan.moe` itself did not answer that day (15 s timeout), so the spec is the
> reference rather than a live call.

## What it says

`/seasons/now`, parameter `continuing`:

> "This is a flag. When supplied it will include entries which are continuing from previous seasons.
> MAL includes these items on the seasons view in the ″TV (continuing)″ section. (Example:
> https://myanimelist.net/anime/season/2024/winter) Example usage: `?continuing`"

`/seasons/now` also documents `filter` (`tv, movie, ova, special, ona, music`), `sfw` and
`unapproved`, and **no `kids`** parameter.

`/anime/{id}/reviews` and `/reviews/anime`, parameter `preliminary`:

> "Any reviews left during an ongoing anime/manga, those reviews are tagged as preliminary. NOTE:
> Preliminary reviews are not returned by default so if the entry is airing/publishing you need to
> add this otherwise you will get an empty list. e.g usage: `?preliminary=true`"

Parameter `spoilers`:

> "Any reviews that are tagged as a spoiler. Spoiler reviews are not returned by default. e.g usage:
> `?spoiler=true`"

## What it does not say

- Which spelling Jikan actually honours. The parameter is named `spoilers` but the example says
  `?spoiler=true`.
- Whether Jikan's defaults are deliberate or follow an older MAL default. MAL's per-title page
  defaults to preliminary **on** (`mal-reviews.md`), the opposite of Jikan's.
