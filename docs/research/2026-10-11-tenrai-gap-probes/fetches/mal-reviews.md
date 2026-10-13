---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime/21/x/reviews?sort=suggested&filter_check=&filter_hide=&preliminary=on&spoiler=on
fetched: 2026-10-11
kind: primary
---

# MyAnimeList review pages (global and per title)

> Fetched 2026-10-11 · The pages behind `/v1/reviews/*` and `/v1/anime|manga/:id/reviews`. Read to
> find whether each review carries an id, reactions, and preliminary or spoiler markers, and whether
> MAL filters those server-side. Fetched through Cloudflare's network (colo POA).

| URL | status | bytes | reviews | Preliminary tag | Spoiler tag |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/reviews.php?t=anime` | 200 | 509,176 | 50 | 5 | 0 |
| `/reviews.php?t=anime&preliminary=off&spoiler=on` | 200 | 519,640 | 50 | 0 | 11 |
| `/anime/21/x/reviews` | 200 | 356,187 | 20 | 20 | 0 |
| `/anime/21/x/reviews?…&preliminary=on&spoiler=on` | 200 | 345,658 | 20 | — | 2 |
| `/anime/21/x/reviews?…&preliminary=off&spoiler=off` | 200 | 108,935 | **0** | 0 | 0 |
| `/manga/2/x/reviews` | 200 | 266,220 | 20 | 20 | 0 |

## What it says

**MAL's own filter toggles, and their defaults** (preliminary on, spoiler off), on the per-title page:

```html
<span class="mr12 btn-crossedbox js-reviews-chk-preliminary on ga-click" data-ga-click-type="review-preliminary"> Preliminary </span> <span class="mr12 btn-crossedbox js-reviews-chk-spoiler ga-click" data-ga-click-type="review-spoiler"> Spoiler </span>
```

…and the query string the pager carries:

```html
<a href="https://myanimelist.net/anime/21/One_Piece/reviews?sort=suggested&amp;filter_check=&amp;filter_hide=&amp;preliminary=on&amp;spoiler=off&amp;p=2"
```

The global page has the same two toggles (`js-reviews-chk-preliminary on`, `js-reviews-chk-spoiler`).
Passing `preliminary=off&spoiler=on` there changed the set: 38 of 50 ids overlap with the default.

**Every review links its id:**

```html
<div class="open"><a href="https://myanimelist.net/reviews.php?id=2772" class="ga-click" data-ga-click-type="review-permalink">
```

**Preliminary carries the progress; spoiler is a tag of its own** (spoilers appear only with `spoiler=on`):

```html
<div class="tag preliminary">Preliminary <span> (344/? eps) </span></div>
<div class="tag preliminary">Preliminary <span> (295/? chp) </span></div>
<div class="tag spoiler">Spoiler</div>
```

Tag classes seen: `recommended`, `mixed-feelings`, `not-recommended`, `preliminary`, `spoiler`, `funny`.

**Reactions are a JSON attribute on the element:**

```html
js-review-element" data-reactions='{"icon":["1","2","4"],"num":6056,"count":["5622","201","40","137","7","46","3"]}'
```

The reaction buttons give the meaning of each position: `data-val` 1 nice, 2 loveit, 3 funny,
4 confusing, 5 informative, 7 creative (`review-anime-reaction-<name>` … `data-val="N"`). `icon` lists
the three largest counts by `data-val` (1, 2, 4 → 5622, 201, 137), which is consistent with
`count[i]` ↔ `data-val = i + 1`. On the global page only 13 of 50 elements carry a non-empty
`data-reactions`; the rest have `data-reactions=''`.

## What it does not say

- The `data-val` of "Well-written": its button markup did not match the same pattern. Position 6 is
  inferred, not read.
- Whether `sort=` accepts anything besides `suggested`. No other value appeared on the page.
- Why 37 of the 50 global reviews have no reactions payload: whether they have none, or the page omits it.
