# Result — probe of Jikan's P0 sources

> Date: 2026-07-19  
> Worker: `jikan-edge-profile-probe`  
> Method: one fixed URL per family; no persistence, no open endpoint and no sweeping.

## Cases executed

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Markers | State |
| --- | --- | ---: | ---: | --- | --- |
| Profile — `/users/{username}` | `/profile/amayacrab` | 200 | 92 KB | present | basic parser approved in the earlier spike |
| Anime detail — `/anime/{id}` | `/anime/1/Cowboy_Bebop` | 200 | 192 KB | present | initial fields: score and synopsis; title being adjusted |
| Search — `/anime` | `/anime.php?q=cowboy+bebop&cat=anime` | 200 | 334 KB | present | 155 anime links identified; itemization pending |
| Ranking — `/top/anime` | `/topanime.php` | 200 | 214 KB | present | 160 anime links identified; ranking/itemization pending |
| Season — `/seasons/now` | `/anime/season` | 200 | 949 KB | present | 715 links identified; `cpuTime: 7 ms`; itemization pending |
| Genres — `/genres/anime` | `/anime.php?cat=genre` | 200 | 326 KB | present | 78 genre entries identified; names pending |

## Main finding

All six sources answered HTTP 200 to the Worker and passed the minimum semantic markers. That approves only the transport stage for this sample.

The experimental profile extractor worked. On the second iteration, the real formats delivered to the Worker were identified: several lists use absolute links, while the genres page exposes `input[name="genre[]"]`. The current season, at approximately 949 KB, completed an observed run with `cpuTime: 7 ms`.

The extractors still count and validate structures; they do not return the Jikan schema and should not be considered product parsers.

## Decision

- **Profile:** `probe approved`, with a `cpuTime: 2 ms` run recorded earlier.
- **Anime, search, ranking, season and genres:** `source accessible; parser pending`.
- **None of the routes is approved for the product yet.**

## Next step

For each pending family, capture a sanitized fixture, identify the real selectors, create a specific parser and measure p50/p95 of `cpuTime` over a representative corpus. The season page should get measurement priority for being approximately 949 KB.

## Continued — manga and character

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Result |
| --- | --- | ---: | ---: | --- |
| Manga detail — `/manga/{id}` | `/manga/2/Berserk` | 200 | 145 KB | title, score `9.46` and synopsis identified |
| Manga search — `/manga` | `/manga.php?q=berserk&cat=manga` | 200 | 273 KB | 137 manga links identified |
| Top manga — `/top/manga` | `/topmanga.php` | 200 | 204 KB | 100 links identified; `cpuTime: 1 ms` |
| Character detail — `/characters/{id}` | `/character/1/Spike_Spiegel` | 200 | 64 KB | title, Animeography and Voice Actors identified |

Manga and character pass only as proofs of transport/initial extraction. The derived routes — voices, pictures, relations, pagination and `full` — still need parsers and contracts of their own.

## Continued — person

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Person detail — `/people/{id}` | `/people/1` | 200 | 1,171 KB | 9 ms | title, the Voice Acting Roles section and 1,087 character links identified |

### Decision for people

**Do not approve a single person parser on Free.** Although the run returned 200, 9 ms exceeds the provisional 8 ms safety margin. The page is approximately 1.17 MB and gathers many credits; a parser extracting all the detailed content would run a high risk of exceeding the 10 ms ceiling.

Alternatives to validate:

1. separate the basic profile from credits/voices into different resources;
2. collect only basic data on a Free Worker and defer the extensive credits;
3. use an executor with more CPU only if the family proves enough value;
4. accept previously processed stale data, without recomputing the complete content during a refresh.

### Rejected optimization attempt

Streaming `HTMLRewriter` was tested, capturing only `title`, the voices heading and character links, without building a string with the whole HTML. On this page, the observed run consumed **44 ms of CPU**, worse than the selective textual parser's 9 ms.

Conclusion: `HTMLRewriter` should not be adopted automatically. For large pages with many matching elements, the cost of the callbacks/selectors can exceed that of a few delimited textual sweeps. The Worker was reverted to the 9 ms textual version while a data segmentation strategy is evaluated.

## Continued — character and person search

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Result |
| --- | --- | ---: | ---: | --- |
| Character search — `/characters` | `/character.php?q=Spike&cat=character` | 200 | 79 KB | 105 character links identified |
| Person search — `/people` | `/people.php?q=Tomokazu&cat=person` | 200 | 53 KB | 38 person links identified |

Both searches are light sources and suitable for moving on to the itemization and contract stage. The source URL for public character/person rankings still needs to be mapped; the direct attempt at `topcharacters.php` returned 404, so it will not be inferred without evidence.

## Continued — character and person rankings

| Family / reference route | Confirmed MAL source | Upstream HTTP | Approximate HTML | Result |
| --- | --- | ---: | ---: | --- |
| Top characters — `/top/characters` | `/character.php` | 200 | 131 KB | 105 character links identified |
| Top people — `/top/people` | `/people.php` | 200 | 95 KB | 100 person links identified |

The character mapping was confirmed by Jikan's historical documentation, which points at `character.php` as the source for top characters. The nonexistent URL `topcharacters.php` stays on record as a discarded attempt.

## Continued — producer

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Producer detail — `/producers/{id}` | `/anime/producer/1/Studio_Pierrot` | 200 | 599 KB | 3 ms | title and 670 anime links identified |

The producer detail is viable in this sample, even with a large page. The producer index/search is not yet approved: `anime.php?cat=producer` did not expose a producer-list marker and will be investigated by fixture/structure, not inferred from the general anime search.

### Producer list

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| List — `/producers` | `/anime/producer` | 200 | 160 KB | 2 ms | title and producer links identified |

The list source passes with wide headroom. `full` and `external` do not require a new page at this stage: they should be treated as contracts derived from the detail, with parsers and fixtures of their own.

## Continued — club

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Club detail — `/clubs/{id}` | `/clubs.php?cid=1` | 200 | 64 KB | 2 ms | title, the Members/Staff sections and 42 profile links identified |

The club detail passes with wide headroom. The members, staff and relations routes need pagination/structure tests of their own before being approved.

### Club members

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Members — `/clubs/{id}/members` | `/clubs.php?action=view&t=members&id=1&show=0` | 200 | 56 KB | 2 ms | 72 profile-link occurrences (36 expected items, an opening tag and a repeated reference) |

The members source passes with wide headroom. The source's pagination uses `show` as an offset in blocks of 36; the adapter must expose pages without leaking that detail. Staff and relations still require a parser/fixture over the detail page.

## Continued — watch collections and upcoming season

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Currently airing / schedules — `/schedules` | `/anime.php?cat=airing` | 200 | 334 KB | 3 ms | 137 anime links identified |
| Upcoming season — `/seasons/upcoming` | `/anime/season/later` | 200 | 1,769 KB | **12 ms** | 1,489 anime links identified |

### Decision for upcoming seasons

**Do not approve `/seasons/upcoming` on Workers Free with the current parser.** The observed run reached 12 ms, above Free's 10 ms ceiling. The HTTP 200 response came from an account with enough execution capacity to record the metric; that does not make the route compatible with Free.

Alternatives: limit pages/items, find a paginated source, run the ingestion outside Free, or keep the route out of the MVP.

## Continued — recent reviews

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recent anime reviews — `/reviews/anime` | `/reviews.php?t=anime` | 200 | 492 KB | 4 ms | title and 50 review links identified |

The recent reviews feed is viable in this sample. This does not yet approve per-title reviews, pagination, spoiler content or text transformation; those are separate contracts.

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recent manga reviews — `/reviews/manga` | `/reviews.php?t=manga` | 200 | 506 KB | 6 ms | title and 50 review links identified |

The manga feed is also viable, but with less headroom than the anime one. Recommendations have no public source mapped yet: the direct attempts at `recommendations.php` returned 404 and were recorded as discarded.

## Continued — manga genres and magazines

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Manga genres — `/genres/manga` | `/manga.php?cat=genre` | 200 | 276 KB | not yet measured | 79 genre entries identified |
| Magazines — `/magazines` | `/manga/magazine` | 200 | 238 KB | 2 ms | 1,484 magazine links identified |

Magazines passes with wide headroom even at high item density. Manga genres is accessible; its CPU measurement can be grouped in future with the validation of name and type extraction.

## Continued — anime sub-resources

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Episodes — `/anime/{id}/episodes` | `/anime/1/_/episode` | 200 | 94 KB | 2 ms | title and 52 episode links identified |
| Videos — `/anime/{id}/videos` | `/anime/1/_/video` | 200 | 78 KB | 2 ms | video page and work markers identified |
| Statistics — `/anime/{id}/statistics` | `/anime/1/_/stats` | 200 | 107 KB | 1 ms | page title and 11 statistic labels identified |

All three sources passed on the real Worker with wide headroom against the provisional 8 ms bar and Free's 10 ms limit. They are MVP candidates, subject to structured parsers and fixtures before exposing public contracts.

The videos HTML uses `youtube-nocookie.com/embed/...`, not the `youtube.com` domain initially expected. After adjusting the pattern to that format, the Worker identified one embed in the sample. The source and the initial trailer/promo URL extraction pass; additional fields and multiple videos still depend on a fixture and a structured parser.

## Continued — public user surfaces

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Anime list — `/users/{username}/animelist` | `/animelist/amayacrab` | 200 | 596 KB | 5 ms | title and 273 anime links identified |
| Manga list — `/users/{username}/mangalist` | `/mangalist/amayacrab` | 200 | 509 KB | 4 ms | title and 227 manga links identified |
| Friends — `/users/{username}/friends` | `/profile/amayacrab/friends` | 200 | 86 KB | 2 ms | title and 132 profile links identified |
| History — `/users/{username}/history` | `/profile/amayacrab/history` | 200 | 92 KB | not yet measured | source accessible; 42 work links detected |
| User reviews — `/users/{username}/reviews` | `/profile/amayacrab/reviews` | 200 | 47 KB | not yet measured | source accessible; the general feed's pattern found no items on this page |

### Decision for user

Anime and manga lists, as well as friends, pass as MVP candidate sources: the real Worker stayed below the provisional 8 ms margin. That does not yet approve pagination, status filters, scores, dates, privacy or the complete response formats.

History and reviews have confirmed transport, but should not get a public contract until a structural inspection and fixtures extract real items. The reused selector failing to match on the reviews page is treated as a signal to investigate the HTML, not as an empty list.

### User clubs and user search

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| User clubs — `/users/{username}/clubs` | `/profile/ZUKUT0/clubs` | 200 | 69 KB | 2 ms | club links identified in a positive fixture |

`/profile/amayacrab/clubs` answered 200 with no visible clubs and is recorded as an empty-list fixture. The positive page passes with wide headroom.

The attempt to use `/users.php?q={username}` as a general search was discarded: it redirects to the exact profile when the name exists, instead of returning search results. The `/users` route of the Jikan contract will require an index/cache of known profiles of our own, or it stays out of the MVP; there is no approved HTML search source at this stage.

### User recommendations

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recommendations — `/users/{username}/recommendations` | `/profile/amayacrab/recommendations?p=1` | 200 | 48 KB | 2 ms | empty response accessible |

The URL and the empty behavior pass. The two fixtures verified (`amayacrab` and `ZUKUT0`) contain no visible recommendations; the route does not get parser approval until a public positive fixture exists, obtained without sweeping profiles.

## Continued — review ranking attempt

The attempts at `/topreviews.php`, `/topreviews.php?type=anime` and `/topreviews.php?type=manga` returned HTTP 404 and were discarded as sources. The page `/reviews.php?t=anime&filter_check=1&order_by=most_helpful` returned HTTP 200 (approximately 482 KB) and is a candidate for investigating the `/top/reviews` contract.

There is no approved mapping yet: it is necessary to confirm in the HTML that the ordering really is the intended one, identify each review's block and measure the Worker's CPU with that parser.

### Result of the `top/reviews` probe

The candidate source returned 200 on the real Worker, at approximately 482 KB, 50 reviews (100 occurrences of `review-element`, opening and closing) and **5 ms of CPU**. The first ten review IDs differ from the default feed; the ordering parameter is changing the result and was not simply ignored.

**Decision:** approve the source as a technical candidate for `/top/reviews`, but keep the contract pending. Before exposing the route, the parser must extract the author, the work, the score, the content/summary, the reactions and pagination, and the exact semantics of `order_by=most_helpful` must be validated by fixture.

## Continued — recent recommendations

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Anime recommendations — `/recommendations/anime` | `/recommendations.php?s=recentrecs&t=anime` | 200 | 397 KB | 5 ms | title and anime links identified |
| Manga recommendations — `/recommendations/manga` | `/recommendations.php?s=recentrecs&t=manga` | 200 | 400 KB | 4 ms | title and manga links identified |

Both sources are viable on a Free Worker in this sample. What is missing before defining the contract: a parser per recommendation block, work pairs, user, content, pagination and fixtures.

The per-work recommendations page was also found at `/anime/1/Cowboy_Bebop/userrecs`, but it is approximately 1.06 MB. It was not grouped with the global feeds: it needs its own probe and decision.

### Per-work recommendations

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recommendations for one work — `/anime/{id}/recommendations` | `/anime/1/Cowboy_Bebop/userrecs` | 200 | 1,054 KB | 7 ms | title and anime links identified |

**Conditional decision:** the source passes the point measurement, but it is close to the provisional 8 ms margin. Do not use a generic parser or multiple complete sweeps; every derived route must have cache/stale, a delimited parser and a corpus with denser pages before being approved for traffic.

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recommendations for one work — `/manga/{id}/recommendations` | `/manga/2/Berserk/userrecs` | 200 | 605 KB | 4 ms | title and 288 manga links identified |

The manga sample has wide headroom and can move on to a specific parser with normal caching. It does not remove the restriction on the equivalent anime route: each family will keep its own size and CPU limits.

## Continued — Watch

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recent episodes — `/watch/episodes` | `/watch/episode` | 200 | 49 KB | 2 ms | 11 episode links identified |
| Popular episodes — `/watch/episodes/popular` | `/watch/episode/popular` | 200 | 147 KB | 1 ms | 162 episode links identified |
| Recent promos — `/watch/promos` | `/watch/promotion?p=1` | 200 | 73 KB | 1 ms | 30 video embeds identified |
| Popular promos — `/watch/promos/popular` | `/watch/promotion/popular` | 200 | 71 KB | 1 ms | 30 video embeds identified |

All four sources are viable on a Free Worker with wide headroom. Still pending: structured extraction of each item, pagination of the recent promos list, empty/404 fixtures and the public contracts.

## Continued — sources derived from anime, manga, character and person

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Anime characters and staff — `/anime/{id}/characters`, `/staff` | `/anime/1/_/characters` | 200 | 1,014 KB | 7 ms | source accessible; character links identified |
| Anime forum — `/anime/{id}/forum` | `/anime/1/_/forum` | 200 | 78 KB | not measured in this batch | source accessible |
| Anime more info — `/anime/{id}/moreinfo` | `/anime/1/_/moreinfo` | 200 | 58 KB | not measured in this batch | source accessible |
| Anime news — `/anime/{id}/news` | `/anime/1/_/news?p=1` | 200 | 70 KB | not measured in this batch | source accessible |
| Anime pictures — `/anime/{id}/pictures` | `/anime/1/jikan/pics` | 200 | 66 KB | not measured in this batch | source accessible |
| Anime reviews — `/anime/{id}/reviews` | `/anime/1/jikan/reviews` | 200 | 290 KB | 2 ms | review blocks identified |
| Manga characters — `/manga/{id}/characters` | `/manga/2/_/characters` | 200 | 170 KB | 1 ms | source accessible |
| Manga forum — `/manga/{id}/forum` | `/manga/2/_/forum` | 200 | 72 KB | not measured in this batch | source accessible |
| Manga more info — `/manga/{id}/moreinfo` | `/manga/2/_/moreinfo` | 200 | 55 KB | not measured in this batch | source accessible |
| Manga news — `/manga/{id}/news` | `/manga/2/_/news?p=1` | 200 | 88 KB | not measured in this batch | source accessible |
| Manga pictures — `/manga/{id}/pictures` | `/manga/2/jikan/pics` | 200 | 64 KB | not measured in this batch | source accessible |
| Manga reviews — `/manga/{id}/reviews` | `/manga/2/jikan/reviews` | 200 | 264 KB | 2 ms | review blocks identified |
| Character pictures — `/characters/{id}/pictures` | `/character/1/jikan/pics` | 200 | 58 KB | not measured in this batch | source accessible |
| Person pictures — `/people/{id}/pictures` | `/people/1/jikan/pics` | 200 | 51 KB | not measured in this batch | source accessible |

### Risk decision

`/anime/{id}/characters` is conditional: although it passed at 7 ms, the 1 MB fixture leaves little headroom. It must use a delimited parser, cache/stale and a corpus of dense pages before product traffic. The other sources in this table have confirmed transport; their CPU measurement is pending only because they are light and do not take priority over the pages already measured.

## Continued — recent users, seasons, clubs and manga statistics

| Family / reference route | MAL source | Upstream HTTP | Approximate HTML | Observed CPU | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Recent users — the basis for `/users` | `/users.php` | 200 | 52 KB | 2 ms | 40 profile references identified |
| Canonical history — `/users/{username}/history` | `/history/amayacrab/all` | 200 | 39 KB | 1 ms | transport accessible; the expected content marker failed |
| Season by year — `/seasons/{year}/{season}` | `/anime/season/2025/winter` | 200 | 1,273 KB | **8 ms** | source accessible, with no CPU headroom |
| Club index — the basis for search | `/clubs.php` | 200 | 102 KB | 1 ms | club links identified |
| Candidate club search | `/clubs.php?action=search&query=cowboy` | 200 | 102 KB | 1 ms | suspicious response; not approved as a search |
| Manga statistics — `/manga/{id}/statistics` | `/manga/2/jikan/stats` | 200 | 124 KB | 2 ms | statistic labels identified |

### Decisions

- **Season by year:** conditional, exactly at the provisional 8 ms bar; cache/stale and a delimited parser are mandatory. It is not a source for a synchronous refresh without an additional corpus.
- **Canonical history:** the transport is light, but the HTML did not confirm the markers expected for the fixture. Do not expose a contract until the structure and the empty/populated cases have been inspected.
- **Club search:** not approved. The candidate URL returned 200, but the result is suspicious and does not prove the term was applied.
- **User search:** `/users.php` is only the recent-users listing; it does not replace a text search. Any `/users?q=` will depend on an index/cache of profiles of our own, not on real-time scraping.

## Closing the source probe

No independent public page families in the Jikan inventory's scope are left untried. Routes such as `full`, `about`, `favorites`, `external`, `relations`, `themes`, `streaming`, character/person credits and staff do not call for a new URL: they are **derived contracts** from pages already tested, and they require parsers, fixtures and schemas of their own. The architectural exceptions are user text search, club search, random, and any pagination/index that requires a local catalog.
