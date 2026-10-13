---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime.php?q=frieren&cat=anime&c[]=a&c[]=b&c[]=c&c[]=d&c[]=e&c[]=f&c[]=g
fetched: 2026-10-11
kind: primary
---

# MyAnimeList anime and manga search results

> Fetched 2026-10-11 · The page behind `/v1/anime?q=` and `/v1/manga?q=`. Read to find which extra
> columns it can show, what it answers for zero results, a page past the end and short queries, and
> whether the type and status values Tenrai accepts exist. Fetched through Cloudflare's network (colo POA).

## What it says

**Extra columns come from `c[]=` on the same request:**

| URL | header row |
| --- | --- |
| `/anime.php?q=frieren&cat=anime` | `Title, Type, Eps., Score` |
| `…&c[]=a&c[]=b&c[]=c&c[]=d&c[]=e&c[]=f&c[]=g` | `Title, Type, Eps., Score, Start Date, End Date, Members, Rated` |
| `/manga.php?q=berserk&cat=manga` | `Title, Type, Vol., Score` |
| `…&c[]=a…&c[]=i` | `Title, Type, Vol., Chap., Score, Start Date, End Date, Members` |

First anime row with all columns: `TV, 10, 8.84, 01-16-26, 03-27-26, 623,240, PG-13`. First manga row:
`Manga, -, -, 9.46, 08-25-89, -, 811,713`. Dates are `MM-DD-YY`, the same format the user lists use.

**Zero results answer 404, with the full search page and a message:**

```html
<div class="normal_header">Search Results</div> <div>No titles that matched your query were found.</div>
```

(`/anime.php?q=zzqqxxyyvvkk&cat=anime`, 404, 201,162 bytes.)

**A page past the end answers 404 with MAL's generic page**, the same template as a nonexistent anime:

| URL | status | bytes | `<h1>` |
| --- | ---: | ---: | --- |
| `/anime.php?q=frieren&cat=anime&show=50` | 404 | 40,316 | `404 Not Found` |
| `/topanime.php?limit=35000` | 404 | 39,984 | `404 Not Found` |
| `/anime/99999999` | 404 | 40,316 | `404 Not Found` |

**A query under three characters is answered as zero results**, and quoting it is not:

| URL | status | rows |
| --- | ---: | --- |
| `/anime.php?q=86&cat=anime` | 404 | "No titles that matched" |
| `/anime.php?q=ab&cat=anime` | 404 | "No titles that matched" |
| `/anime.php?q=86+&cat=anime` | 404 | "No titles that matched" |
| `/anime.php?q=%2286%22&cat=anime` (`"86"`) | 200 | 41457 *86*, 48569 *86 Part 2*, 50475 *86 Part 2 Recaps*, 49235 *86 Special Edition…* |
| `/anime.php?q=%22ab%22&cat=anime` | 200 | substring matches: *Absolute Duo*, *Made in Abyss*, … |
| `/anime.php?q=%22K%22&cat=anime` | 200 | *K-On!*, *Saiki Kusuo no Ψ-nan*, … |
| `/manga.php?q=%2286%22&cat=manga` | 200 | 104039 *86*, 112236 *86*, 157600 *86: Alter*, … |

**Type and status values verified by the type column of the results:**

| URL | rows | types in the result |
| --- | ---: | --- |
| `/anime.php?q=gundam&cat=anime&type=7` | 2 | `CM` |
| `…&type=8` | 3 | `PV` |
| `…&type=9` | 7 | `TV Special` |
| `/manga.php?q=sword&cat=manga&type=2` | 32 | `Light Novel` |
| `…&type=8` | 3 | `Novel` |
| `…&status=4` | 4 | `Manga, Manhwa` |
| `…&status=5` | 3 | `Manhwa, Manhua` |

## What it does not say

- Whether `status=4` and `status=5` return *only* hiatus and discontinued titles. The results table
  has no status column, so the filter is seen to narrow the set but not checked entry by entry.
- Whether a quoted query matches by phrase or by substring for every input. `"ab"` behaves like a
  substring match; longer quoted queries were not tried.
- Whether a generic 404 on page 1 could ever mean "past the end". Every past-the-end case measured
  was on a page greater than 1.
