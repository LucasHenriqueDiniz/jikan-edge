---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime/21
fetched: 2026-10-11
kind: primary
---

# MyAnimeList detail pages measured against each parser's fixed window

> Fetched 2026-10-11 · Every detail parser except the character one, which has its own file. Read to
> check whether the `slice(0, N)` window each parser keeps contains every field it reads. Fetched
> through Cloudflare's network (throwaway `wrangler dev --remote` probe, colo POA).

| family | window | URL | status | bytes |
| --- | ---: | --- | ---: | ---: |
| anime | 90,000 | `/anime/21` | 200 | 302,807 |
| | | `/anime/235` | 200 | 356,578 |
| | | `/anime/1735` | 200 | 344,048 |
| manga | 90,000 | `/manga/13` | 200 | 163,913 |
| | | `/manga/2` | 200 | 150,042 |
| person | 60,000 | `/people/1` | 200 | 1,179,030 |
| | | `/people/185` | 200 | 1,434,548 |
| | | `/people/65` | 200 | 1,019,931 |
| | | `/people/118` | 200 | 1,149,523 |
| producer | 60,000 | `/anime/producer/18` | 200 | 1,713,430 |
| | | `/anime/producer/1` | 200 | 604,789 |
| | | `/anime/producer/141` | 200 | 170,234 |
| club | 60,000 | `/clubs.php?cid=1` | 200 | 65,790 |
| statistics | 120,000 | `/anime/21/x/stats` | 200 | 154,703 |
| | | `/manga/13/x/stats` | 200 | 126,392 |
| profile | 30,000 | `/profile/Xinil` | 200 | 97,486 |
| | | `/profile/amayacrab` | 200 | 93,896 |

## What it says

The furthest anchor each parser reads, and where it ends:

| family | worst page | last anchor | ends at | verdict |
| --- | --- | --- | ---: | --- |
| anime | `/anime/1735` | synopsis `</p>` | 110,660 | **cut** on all three pages (21: 97,919; 235: 93,157) |
| manga | `/manga/2` | synopsis `</span>` | 49,155 | 40,845 B margin |
| person | `/people/118` | about `js-people-informantion-more` | 36,088 | 23,912 B margin |
| producer | `/anime/producer/141` | `Member Favorites` | 33,362 | 26,638 B margin |
| club | `/clubs.php?cid=1` | `<h1 class="h1">` | 28,684 | 31,316 B margin |
| statistics | `/anime/21/x/stats` | last score row | 96,102 | 23,898 B margin |
| profile | `/profile/Xinil` | `<span class="di-ib po-r">…'s Profile` | 33,953 | **past the window**, but `user-profile.parser.ts:61-62` falls back to `<title>` |

The anime synopsis starts past or near the window and the regex needs its closing tag:

| page | `<p itemprop="description">` starts | `</p>` ends |
| --- | ---: | ---: |
| 21 | 96,736 | 97,915 |
| 235 | 91,930 | 93,153 |
| 1735 | 109,785 | 110,656 |

```html
<p itemprop="description">Barely surviving in a barrel after passing through a terrible whirlpool at sea, carefree Monke…
```

**Person fields, raw, from `/people/1`:**

```html
Alternate names:</span> Seki Mondoya, 門戸 開, Monto Hiraku</div>
Birthday:</span> Sep  8, 1972</div>
Website:</span> <a href="http://"></a>
Twitter: @<a href="http://twitter.com/seki0908" target="_blank" rel="nofollow noopener noreferrer">seki0908</a><br />
```

The website field is empty (`http://`). The Twitter handle is an inline anchor directly after `@`,
with no whitespace between them.

**A nonexistent anime answers 404 with MAL's generic page**, 40,316 bytes:
`<h1 class="h1">404 Not Found</h1>`. A nonexistent club (`/clubs.php?cid=99999999`) answers 404 with
`<h1>Invalid</h1>`.

## What it does not say

- Whether these pages are the largest of their kind. They were picked as likely-large (long-running
  shows, prolific voice actors, big studios), not found by a sweep.
- Why the anime sidebar grew past 90 KB. Whatever moved the synopsis down is not visible from one
  snapshot.
