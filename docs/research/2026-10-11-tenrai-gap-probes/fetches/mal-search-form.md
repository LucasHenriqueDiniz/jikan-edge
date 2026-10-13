---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime.php
fetched: 2026-10-11
kind: primary
---

# MyAnimeList advanced search forms (`anime.php`, `manga.php`)

> Fetched 2026-10-11 · The search forms themselves, not a result page. Read for the real `<select>`
> vocabularies (type, status, columns) and because the producer dropdown turned out to be a complete
> producer list. Fetched through Cloudflare's network (colo POA).

| URL | status | bytes |
| --- | ---: | ---: |
| `/anime.php` | 200 | 223,329 |
| `/manga.php` | 200 | 163,120 |
| `/anime/producer` (the directory, for comparison) | 200 | 167,102 |

## What it says

**Anime `type`:** `0 Select type, 1 TV, 2 OVA, 3 Movie, 4 Special, 5 ONA, 6 Music, 7 CM, 8 PV, 9 TV Special`.

```html
<option value="6">Music</option><option value="7">CM</option><option value="8">PV</option><option value="9">TV Special</option></select>
```

**Manga `type`:** `1 Manga, 3 One-shot, 4 Doujinshi, 2 Light Novel, 8 Novel, 5 Manhwa, 6 Manhua`.

```html
<option value="3">One-shot</option><option value="4">Doujinshi</option><option value="2">Light Novel</option><option value="8">Novel</option><option value="5">Manhwa</option><option value="6">Manhua</option>
```

**Manga `status`:** `2 Finished, 1 Publishing, 4 On Hiatus, 5 Discontinued, 3 Not yet published`.
**Anime `status`:** `2 Finished Airing, 1 Currently Airing, 3 Not yet aired`.

**Columns (`c[]`).** Anime: `a Type, b Eps, c Score, d Start Date, e End Date, f Total Members, g Rating`.
Manga: `a Type, b Volumes, g Chapters, c Score, d Start Date, e End Date, f Total Members`.

```html
name="c[]" size="5"><option value="a" selected>Type</option><option value="b" selected>Eps</option><option value="c" selected>Score</option><option value="d">Start Date</option><option value="e">End Date</option><option value="f" selected>Total Members</option><option value="g">Rating</option></select>
```

**The producer dropdown has 2,833 options**, ids up to 3,412. It includes every "Toei" entry Tenrai
returned:

```html
<select name="p" id="p" class="inputtext"><option selected="selected" value="0">Select producer</option><option value="3010">.MP</option><option value="2696">100studio</option>…
```

Toei entries in it: `2962 Toei Academy, 2292 Toei Advertising, 18 Toei Animation, 3178 Toei Animation (Shanghai) Enterprises, 141 Toei Video`.
The directory page `/anime/producer` links **930** distinct producer ids and does not contain 141.

**The manga form's magazine dropdown (`mid`) has 1,499 options.** Production's `/v1/magazines`
returned 1,457 and Tenrai's 1,474.

## What it does not say

- Whether the dropdown is ever paginated or trimmed. It arrived whole in one 223 KB page here.
- The producer's kind (studio, licensor, producer) or its anime count. The dropdown carries only the
  id and the name; the directory has the counts for the 930 it lists.
