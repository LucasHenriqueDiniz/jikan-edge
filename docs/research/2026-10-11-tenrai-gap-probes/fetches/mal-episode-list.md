---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://myanimelist.net/anime/21/x/episode?offset=100
fetched: 2026-10-11
kind: primary
---

# MyAnimeList episode list and episode detail

> Fetched 2026-10-11 · The pages behind `/v1/anime/:id/episodes` and `/episodes/:episode`. Read to
> settle whether the list paginates, how filler rows are marked, and what a nonexistent episode
> returns. Fetched through Cloudflare's network (colo POA).

| URL | status | bytes | rows | episode range | Filler rows |
| --- | ---: | ---: | ---: | --- | ---: |
| `/anime/21/x/episode` | 200 | 242,042 | 100 | 1–100 | 11 |
| `/anime/21/x/episode?offset=100` | 200 | 243,489 | 100 | 101–200 | 19 |
| `/anime/21/x/episode?offset=1100` | 200 | 208,280 | 80 | 1101–1180 | 0 |
| `/anime/21/x/episode?offset=99900` | 200 | 105,561 | 0 | — | — |
| `/anime/1/x/episode?offset=100` | 200 | 85,266 | 0 | — | — |
| `/anime/21/x/episode/1` | 200 | 152,463 | | | |
| `/anime/21/x/episode/99999` | **200** | 98,955 | | | |

## What it says

**The list paginates with `?offset=N`, 100 rows a page**, and the pager links every block:

```html
<div class="pagination ac"><a class="link current" href="https://myanimelist.net/anime/21/One_Piece/episode?offset=0">1 - 100</a><a class="link" href="https://myanimelist.net/anime/21/One_Piece/episode?offset=100">101 - 200</a><a class="link" href="https://myanimelist.net/anime/21/One_Piece/episode?offset=200">201 - 300</a><span class="skip">></span><a class="link" href="https://myanimelist.net/anime/21/One_Piece/epi…
```

On page 1 the distinct offsets linked are `0, 100, 200, 1100`, so the last block is readable from the
pager itself (1,180 episodes in 12 pages). An offset past the end answers **200 with zero rows**.

**A filler row puts a `<span>` before the title anchor**, which is what
`src/parsers/episodes.parser.ts:19` (`class="episode-title[^"]*">\s*<a href=`) does not expect:

```html
<td class="episode-title fs12"><span class="fl-r di-ib pr4 icon-episode-type-bg">Filler</span><a href="https://myanimelist.net/anime/21/One_Piece/episode/50" class="fl-l fw-b ">Usopp vs. Daddy the Parent! Showdown at Hi…
```

Page 1's 11 Filler rows are the same 11 episodes production drops (50, 51, 54–60, 98, 99).

**A nonexistent episode answers 200** with the title `One Piece - Episode 99999 - MyAnimeList.net`.
The markers `fs18 lh11` and `Aired` are present on both episode 1 and episode 99999. What separates
them is the heading, which carries no title, and a `badresult` block episode 1 does not have:

```html
<h2 class="fs18 lh11" …> <span class="fw-n">#99999 - </span><span class="ml8 icon-episode-type-bg"> </span></h2>
<div class="badresult al"> Sorry, this anime doesn't seem to have any episode information yet. Maybe you can help us out?<br />
```

Episode 1 has `<span class="fw-n">#1 - </span>I&#039;m Luffy! The Man Who&#039;s Gonna Be King of the Pirates!</h2>`
and a `Synopsis</h2>` block; episode 99999 has neither.

## What it does not say

- What a Recap row looks like. No Recap row appeared on the three pages read. The class
  `icon-episode-type-bg` is assumed to carry `Recap` the same way, but that is not measured.
- Whether an episode number that exists but has no data yet (an upcoming episode inside the announced
  count) also renders the `badresult` block. The message reads as if it would, which would make that
  episode a 404 too.
