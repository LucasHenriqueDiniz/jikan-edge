# `genres/anime` and `genres/manga` — MAL reduces the content for Cloudflare's network

> **Resolved on 2026-07-30** by changing the taxonomy's source (the sidebar is still truncated; the search page is not). See "Current state" at the end of the document. The diagnosis below stays as a record.

Date: 2026-07-26. Discovered while implementing the manga catalog and noticing that `/v1/genres/manga` returned only 12 genres (the real figure: ~300+, counting genres of every content type listed in the sidebar). Investigation showed that the same had been affecting `/v1/genres/anime` since the first deploy — it had simply gone unnoticed because the earlier validation looked at a truncated preview of the response, not the total count.

## Evidence

Fetching the SAME URL (`https://myanimelist.net/anime/genre/1/Action`), comparing origins:

| Fetch origin | `<span class="genre">` count | Document size |
| --- | ---: | ---: |
| PowerShell directly (my home network) | 284–316 (it varied between attempts, but always in the hundreds) | ~630–790 KB |
| `wrangler dev --local` (local Workers runtime, but fetching through my network) | 284 | 791 KB |
| Worker published in production (Cloudflare's real network) | 12–13 | not captured, but clearly a much smaller document |

The HTTP status is 200 in all three cases — there is no error, redirect or challenge/captcha marker detectable by `classifyHtml`. MAL simply serves a reduced genre sidebar (~12 items) specifically for requests arriving through Cloudflare's network/datacenter, probably as anti-scraping mitigation targeted at that kind of traffic — the same class of phenomenon already recorded (without a confirmed root cause) in `docs/results/cloudflare-1042-investigation.md`.

**Individual detail** pages (anime, manga) and **ranking** pages (top anime, top manga, current season) did not show this problem — they were validated extensively in production with complete, correct data. The problem appears specific to genre **browse/aggregation** pages.

## Fix applied

`parseAnimeGenres`/`parseMangaGenres` now reject results with fewer than 20 genres (`MIN_EXPECTED_GENRES`), throwing `ParserError` instead of silently accepting an incomplete list as valid. This follows the project's rule ("never replace valid data with a suspicious document"), but it has a real consequence: **`/v1/genres/anime` and `/v1/genres/manga` return 500 in production now**, because every refresh attempt through Cloudflare's network receives the reduced version and never the complete one. Before the fix, those routes returned 200 with silently incomplete data (13/12 items) — worse, but with no visible error.

## Current state

**Resolved on 2026-07-30 by option 2** (an alternative source). The block was on the genre browse page, not on the taxonomy itself.

### The source that works

The "Content Filter" block of the search page (`https://myanimelist.net/anime.php?cat=genre` and `manga.php?cat=genre`) carries the entire taxonomy as form markup, already split into the four categories Jikan exposes and with the title count per genre:

```html
<div class="fs10 fw-b mb4 category-type">Genres</div>
  <input id="genre-1" name="genre[]" type="checkbox" value="1" ...><p>Action (5,003)</p>
```

| Fetch origin | Genre entries | Document |
| --- | ---: | ---: |
| PowerShell directly (home network) | 78 anime / 79 manga | 335 KB / 277 KB |
| Worker on Cloudflare's edge (`wrangler dev --remote`, 2026-07-30) | **78 anime / 79 manga** | — |

The response came back with `meta.stale: false`, that is, a genuinely successful refresh and not a cache fallback. The distribution matched the direct fetch exactly: 18 genres, 3 explicit genres, 52 themes and 5 demographics for anime; the same for manga with 53 themes.

That evidence is not new, incidentally: the 2026-07-19 probe (`docs/results/2026-07-19-p0-source-route-probe.md`) had already measured `anime.php?cat=genre` at 78 entries **through a published Worker**. The original implementation picked the sidebar anyway, and the problem only surfaced a week later. Worth remembering: the probe's evidence was right and was contradicted in the implementation without anyone noticing.

### Why the sidebar truncates and this page does not

No confirmed explanation. The observed pattern — genre browse/aggregation pages reduced, detail, ranking and search pages intact — still holds, and the search page falls on the intact side. There was no attempt to work around the sidebar's behavior (alternative headers, IP rotation): the route moved to a different public source, within the same rules.

### What changed in the code

`parseAnimeGenres`/`parseMangaGenres` (one parser per type, reading `<span class="genre">`) were replaced by a single `parseGenreTaxonomy(html, type)`. The completeness guard stopped being "≥ 20 items" and now requires all four categories present **and** ≥ 40 entries — a reduced document loses an entire category before it loses count. The payload gained `count` and `type`; the route gained `?filter=`. See `docs/routes.md`.
