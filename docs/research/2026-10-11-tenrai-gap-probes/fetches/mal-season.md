---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime/season
fetched: 2026-10-11
kind: primary
---

# MyAnimeList season pages

> Fetched 2026-10-11 · The pages behind `/v1/seasons/now` and `/v1/seasons/:year/:season`. Read to
> check the premise behind refusing `continuing` and `kids` ("no equivalent switch on the public
> pages", `src/http/query-contract.ts:180-181`). Fetched through Cloudflare's network (colo POA).

| URL | status | bytes | cards |
| --- | ---: | ---: | ---: |
| `/anime/season` | 200 | 1,208,575 | 165 |
| `/anime/season/2024/spring` | 200 | 2,066,941 | 261 |

## What it says

**Each block of cards sits under an `anime-header`, and one of them is the continuing block:**

```html
<div class="anime-header">TV (Continuing)</div>
```

| section | `/anime/season` | `/anime/season/2024/spring` |
| --- | ---: | ---: |
| TV (New) | 73 | 70 |
| TV (Continuing) | 45 (includes One Piece, 21) | 51 (includes One Piece, 21) |
| ONA | 22 | 80 |
| OVA | 9 | 20 |
| Movie | 15 | 29 |
| Special | 1 | 11 |

**Cards carry `kids` and `r18` in their own class list**, next to the type class the parser already
reads, and a `data-genre` list:

```html
<div class="js-anime-category-producer seasonal-anime js-seasonal-anime kids js-kids js-anime-type-all js-anime-type-1" data-genre="14,7,37,15"
```

On `/anime/season`, 26 cards are `kids` and 13 are `r18`; on 2024/spring, 48 and 21.

Production's `/v1/seasons/now` returned 165 entries, the same 165 ids as the page. Tenrai's returned a
total of 120 without One Piece: 165 minus the 45 continuing.

## What it does not say

- Whether the `anime-header` blocks keep this order on every season page. Two pages were read.
  `season-now.parser.ts:30-34` records why the header is the wrong anchor for the *type*: the
  schedule page reuses the cards under day headings. That objection is about the schedule page and
  about type, not about the continuing section of a season page.
- What MAL's UI does with `kids` and `r18` by default. The server sends every card; any hiding happens
  client-side.
