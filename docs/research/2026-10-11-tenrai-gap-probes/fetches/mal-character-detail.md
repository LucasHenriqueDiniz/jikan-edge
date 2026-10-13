---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/character/40
fetched: 2026-10-11
kind: primary
---

# MyAnimeList character detail pages

> Fetched 2026-10-11 · The page `parseCharacterDetail` reads. Read to find where each field sits in
> bytes, which name forms the page offers, and what a nonexistent id returns. Fetched through
> Cloudflare's network (throwaway `wrangler dev --remote` probe, colo POA, the production
> `MAL_USER_AGENT`).

| URL | status | bytes |
| --- | ---: | ---: |
| `/character/40` (Luffy) | 200 | 150,862 |
| `/character/417` (Lelouch) | 200 | 128,726 |
| `/character/62` (Zoro) | 200 | 145,077 |
| `/character/1` (Spike) | 200 | 65,419 |
| `/character/17` (Naruto) | 200 | 131,854 |
| `/character/246` (Goku) | 200 | 159,432 |
| `/character/99999999` | **200** | 39,574 |

## What it says

**Byte offset where each field the parser reads ends**, measured on the body above. The parser keeps
`html.slice(0, 60_000)` (`src/parsers/character-detail.parser.ts:47`).

| page | `<small>(` kanji ends | `Member Favorites:` | about block ends |
| --- | ---: | ---: | ---: |
| 40 | 112,650 | 111,025 | 120,022 |
| 417 | 79,483 | 77,830 | 105,682 |
| 62 | 106,613 | 105,005 | 110,521 |
| 1 | inside 60 KB | inside 60 KB | 42,037 |
| 17 | 92,707 | 91,087 | 98,943 |
| 246 | 97,283 | 95,693 | 104,783 |

Five of six pages put all three fields past the 60 KB window.

**The name, four ways on the same page (character 40):**

```html
<meta property="og:title" content="Luffy Monkey D.">
<h1 class="title-name h1_bold_none"><strong>Luffy &quot;Mugiwara, Straw Hat&quot; Monkey D.</strong></h1>
<h2 class="normal_header" style="height: 15px;">Luffy Monkey D. <span style="font-weight: normal;"><small>(モンキー・D・ルフィ)</small></span></h2>
Member Favorites: 150,082
```

The `<title>` reads `Luffy Monkey D. (One Piece) - MyAnimeList.net`. The family-first form `Monkey D., Luffy`
occurs **once**, inside a sidebar ranking widget, and only because Luffy is ranked:

```html
<span class="rank">2</span> <a href="https://myanimelist.net/character/40/Luffy_Monkey_D">Monkey D., Luffy</a> </li>
```

Lelouch's `<h1>` carries six nicknames: `Lelouch &quot;Lelouch vi Britannia, Zero, Lulu, Black Prince, The Demon Emperor, L.L.&quot; Lamperouge`.
Spike's has none: `Spike  Spiegel`.

**A nonexistent id answers 200**, not 404:

```html
<h1 class="h1">Invalid</h1></div><div id="content"><div class="badresult">Invalid ID provided.</div></div>
```

## What it does not say

- Where a family-first name for an *unranked* character could come from on this page. None was found
  outside the ranking widget.
- Whether every character page above some size cuts the same way. Six pages were measured, not a
  distribution.
