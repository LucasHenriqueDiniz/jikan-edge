# Jikan v4 route validation

> Inventory source: [Jikan REST's OpenAPI](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json), consulted on 2026-07-19.  
> Current surface: 100 GET routes. This is a coverage reference, not a compatibility promise.

## Validation principle

Do not run 100 independent scrapes. There are two distinct levels:

1. **Source/parser:** test each type of MyAnimeList HTML page with a representative corpus and measure Cloudflare's `cpuTime`.
2. **Contract:** for each selected Jikan route, test the transformation of the already-collected data into JSON, plus pagination, errors and the expected missing fields.

So, for example, `/anime/{id}`, `/anime/{id}/relations` and `/anime/{id}/themes` may originate from the same main page, but they are still three different contracts.

## Inventory by group

| Group | Routes | Routes / families |
| --- | ---: | --- |
| Anime | 21 | detail, full, characters, staff, episodes, news, forum, videos, pictures, statistics, relations, themes, streaming, search |
| Manga | 14 | detail, full, characters, news, forum, pictures, statistics, relations, reviews, external, search |
| Users | 16 | profile, about, statistics, favorites, lists, friends, clubs, history, reviews, recommendations, updates, search |
| Characters | 7 | detail, full, anime, manga, voices, pictures, search |
| People | 7 | detail, full, anime, manga, voices, pictures, search |
| Clubs | 5 | detail, members, staff, relations, search |
| Top | 5 | anime, manga, people, characters, reviews |
| Random | 5 | anime, manga, characters, people, users |
| Producers | 4 | list, detail, full, external |
| Seasons | 4 | list, current, upcoming, year/season |
| Watch | 4 | episodes and promos; recent and popular |
| Genres | 2 | anime, manga |
| Recommendations | 2 | anime, manga |
| Reviews | 2 | anime, manga |
| Magazines | 1 | collection/search |
| Schedules | 1 | calendar |

## Highest-priority routes for the first corpus

| Priority | Routes | Reason |
| --- | --- | --- |
| P0 | `/anime/{id}`, `/anime`, `/top/anime`, `/seasons/now`, `/genres/anime` | the useful core of catalog and search |
| P0 | `/users/{username}`, `/users/{username}/statistics`, `/users/{username}/animelist`, `/users/{username}/mangalist` | validates the profile type already proven in the spike |
| P1 | `/manga/{id}`, `/manga`, `/top/manga`, `/seasons/{year}/{season}` | a second entity and collection pages |
| P1 | characters, people, producers, relations and pictures | relations and derived models |
| P2 | clubs, forum, news, reviews, recommendations, watch, schedules | high volatility, community pages or uncertain cost |

## Per-route criteria

A route only reaches the `validated` state once it has:

- an identified source URL and an allowed fixture page;
- normal, empty, 404 and suspicious-response cases defined where applicable;
- a `cpuTime` p95 below 8 ms across the family's corpus;
- a response schema and required fields defined;
- a contract test for pagination, filters and nulls where they exist;
- TTL, stale policy and refresh cost recorded.

## Order of work

1. Consolidate the corpus by page family.
2. Run fetch/parsing probes per family — never a mass sweep.
3. Record each parser's CPU and quality.
4. Create adapters and contract tests per route only for approved families.
5. Maintain a state matrix: `not started`, `probe`, `approved`, `blocked` or `deferred`.

## Matrix after the source probes

`Source approved` below means only that the HTML answered and the point CPU measurement stayed within the margin; it is not equivalent to a validated product route.

| Family | Source state | Pending for a product route |
| --- | --- | --- |
| Anime: detail, search, top, current season, genres | source accessible; current season measured at 7 ms | item parsers, fixtures, contracts and pagination |
| Anime: characters/staff, forum, moreinfo, news, pictures and reviews | sources accessible; characters/staff 7 ms, reviews 2 ms | **fully implemented** (characters/staff, forum, news, pictures and reviews in earlier batches; `moreinfo` on 2026-07-26) |
| Anime: episodes, videos, statistics | **source approved**: 2 ms, 2 ms and 1 ms | a structured parser, fixtures and contracts; video embed confirmed on `youtube-nocookie.com` |
| Anime: per-title recommendations and reviews | conditional source: 7 ms, a 1.054 MB page | **implemented on 2026-07-26** (`GET /v1/anime/:id/recommendations`, `GET /v1/anime/:id/reviews`) |
| Manga: detail, search, top, genres, magazines | source accessible; top 1 ms and magazines 2 ms | parsers, fixtures and contracts; genres without a CPU measurement |
| Manga: characters, forum, moreinfo, news, pictures and reviews | sources accessible; characters 1 ms, reviews 2 ms | **fully implemented** (characters, forum, news, pictures and reviews in earlier batches; `moreinfo` on 2026-07-26) |
| Manga: per-title recommendations and reviews | source approved: 4 ms | **implemented on 2026-07-26** (`GET /v1/manga/:id/recommendations`, `GET /v1/manga/:id/reviews`) |
| Manga: statistics | source approved: 2 ms | a distribution parser, fixture and contract |
| User: profile, lists and friends | lists/source approval at 5 ms and 4 ms; friends 2 ms | a list parser, filters, privacy, pagination and contracts |
| User: history and reviews | source accessible | an item parser and a CPU measurement |
| User: clubs | source approved: 2 ms; positive and empty fixtures | an item parser and contract |
| User: recommendations | source and empty response approved: 2 ms | a positive fixture and an item parser |
| Recent users | source approved: 2 ms | a parser and a product decision; it is not a text search |
| User: canonical history | transport at 1 ms; suspicious marker | structural inspection, fixtures and a parser |
| Character: detail, search, pictures, anime, manga, voices and full | source accessible | **group complete (7/7)** — every route in the Jikan inventory implemented on 2026-07-26 |
| Person: detail | **implemented on 2026-07-26** after the upgrade to the Workers Paid plan — Free's CPU block (9 ms measured earlier; a real 1.25 MB page confirmed at `/people/11/Kouichi_Yamadera`) no longer applies. `GET /v1/people/:id` is in production. | — |
| Person: detail, search, top, pictures, anime, manga, voices and full | source accessible | **group complete (7/7)** — every route in the Jikan inventory implemented on 2026-07-26 |
| Producer: detail, full and external | source approved: 2 ms and 3 ms | **`full` and `external` implemented on 2026-07-26** (`GET /v1/producers/:id/full`, `GET /v1/producers/:id/external`); the producer list (`/v1/producers`, a listing without search) remains out of scope |
| Club: index, detail, members and staff | source approved: 1 ms, 2 ms and 2 ms | **implemented on 2026-07-26**: `GET /v1/clubs?page=` (index, no search), `GET /v1/clubs/:id/members`, `GET /v1/clubs/:id/staff` |
| Club search | **reconfirmed blocked on 2026-07-26** with an identified root cause: `clubs.php?q=` does not filter server-side (a real query and a nonsense query return the same set of clubs); the real search is a client-side Vue component that dispatches to an internal incremental endpoint, outside what the project's rules allow reaching | it would require a club index of our own; without that, there is no valid path |
| Schedules | source approved: 3 ms | a calendar parser and contract |
| Upcoming season | **blocked in the current parser**: 12 ms | pagination/a smaller source/processing outside Free |
| Season by year | conditional: 8 ms | cache/stale and a delimited parser; an additional corpus before traffic |
| Recent reviews: anime and manga | source approved: 4 ms and 6 ms | itemization, spoilers, pagination and contract |
| Top: reviews | **investigated and declined on 2026-07-26**: `reviews.php` has no sort by helpfulness/votes and no date granularity sufficient to interleave anime+manga | implementing it would require a real ranking mechanism on MAL that does not exist today; see the note in `docs/routes.md` |
| Watch: recent and popular episodes/promos | source approved: 2 ms, 1 ms, 1 ms and 1 ms | an item parser, pagination, fixtures and contract |
| Recommendations: anime and manga | source approved: 5 ms and 4 ms | work pairs, author, content, pagination, fixtures and contract |
| News, forum and pictures | HTML sources accessible; priority CPU measured on the heavy pages | parsers, fixtures, pagination and contracts |
| External, relations, themes and streaming | contracts derived from the already-tested detail | define fields, fixtures and adapters; they need no new URL |
| Random | no upstream page of its own | a local catalog/cache and a selection policy |
| User search | **implemented on 2026-07-26**: `users.php?q=` genuinely filters server-side (confirmed by comparing the results of two distinct real queries, with zero overlap); a query with no match returns MAL's native 404, with no popularity fallback | `GET /v1/users?q=` is in production |

## Expansion decision (2026-07-26)

After validating user profile/statistics/favorites/updates/lists (6 of the Users group's 16 routes), the recorded decision is to follow the P0/P1/P2 prioritization already defined above rather than aiming at all 100 routes at once. This cycle promotes **4 of the 5 P0 anime routes** to implementation: `/anime/{id}`, `/genres/anime`, `/top/anime`, `/seasons/now`.

Reconnaissance was done live against MAL's real pages (via a browser, one fetch per family — not a sweep) before designing the parsers, replacing the "source accessible" entries in the table above with confirmation of real selectors:

- **Anime detail** (`/anime/{id}/{slug}`): title in `h1.title-name strong`; score in `span[itemprop="ratingValue"]`; image in `img[itemprop="image"]` (`data-src`/`src`); synopsis in `p[itemprop="description"]`; structured fields (Episodes, Status, Aired, Studios, Source, Duration, Rating, Ranked, Popularity, Members, Favorites) in `div.spaceit_pad > span.dark_text` + value; Genres/Themes as `a[href^="/anime/genre/"]` inside the same block.
- **Top anime** (`topanime.php`): `tr.ranking-list` rows, 50 per page with MAL's native pagination (`?limit=`); rank, link/image, score (`.score .text`) and loose metadata in `div.information`.
- **Current season** (`/anime/season`): `div.seasonal-anime`, confirmed at **194 cards in a single document with no MAL pagination**; convenient fields in hidden spans `.js-score`, `.js-members`, `.js-start_date`, `.js-title`.
- **Genres** (`/anime/genre/{id}/{slug}`, used only to extract the genre sidebar): the complete list as `span.genre > a[href^="/anime/genre/"]`, but **with no per-genre count visible on a cheap page** — Jikan's `count` field is omitted/null in this implementation (a documented simplification).
  - **Corrected on 2026-07-30; two claims in this item were wrong.** The sidebar does *not* carry the complete list when the requester is Cloudflare's network (~12 of 78 entries — that is what produced the 500s documented in `docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md`), and the per-genre count **does** exist on a cheap page: the "Content Filter" block of `anime.php?cat=genre` carries name, id, category and count together. The source was switched to that page; `count` is no longer omitted. The 2026-07-19 probe (the table row under "Genres — `/genres/anime`", 78 entries) already pointed at it.
- **Anime search** (`anime.php?q=`): confirmed to return real results, but pagination and filters were not mapped — **deferred**, not part of this cycle.

The equivalent manga routes and the P1/P2 groups (characters, people, producers, clubs, etc.) remain outside this cycle, to be decided once the anime pattern is validated in production.

### Real corpus and production p95 (2026-07-26)

Measured with `wrangler tail` against the published Worker — see the full detail in [docs/results/2026-07-26-catalog-corpus-benchmark.md](../results/2026-07-26-catalog-corpus-benchmark.md).

- **Anime detail** (several rounds, ~24 distinct real IDs in total): cpuTime typically 5-8 ms, but with intermittent spikes of **13-15 ms** on titles with no apparent relation to document size (Death Note, Violet Evergarden, Code Geass R2) — **above the Free plan's real 10 ms ceiling**. An attempt to optimize `MalClient` to read only a prefix of the body via a stream was tested and **reverted**: the same spikes appeared in both the optimized and the original version, so the cause is not in the application's code (local parsing of the real HTML took ~0.5 ms, far below what was observed) — see the detail in [docs/results/2026-07-26-catalog-corpus-benchmark.md](../results/2026-07-26-catalog-corpus-benchmark.md).
- **Top anime** (4 real pages): cpuTime p50 6 ms, p95 7 ms, wallTime very stable (~1.35 s) — low risk.
- **Genres (anime and manga)**: **blocked** — MAL serves a reduced genre sidebar (~12-13 items, the real figure is ~40+/300+) specifically for requests coming from Cloudflare's network, with a normal HTTP 200 (not a detectable challenge/captcha). Confirmed by comparing a direct fetch (home network, 284-316 items) against the published Worker (12-13 items) for the same URL. After adding a minimum-size validation to the parser, `/v1/genres/anime` and `/v1/genres/manga` started returning 500 (before, they returned 200 with silently incomplete data). See [docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md](../results/2026-07-26-genre-taxonomy-cloudflare-network-block.md). No root cause resolved — the same category as the already-documented "1042" phenomenon.
- **Current season**: only measured on a cache hit in this round (cpuTime 1 ms); each one's real miss happened before the tail was connected. It is a singleton resource — there is no corpus of variations to sample, only rescheduling the measurement for the next TTL expiry.

The sample is still small and was measured under different code versions — treat it as a preliminary corpus. The finding of 13-15 ms spikes in anime detail is more serious than the initial measurement suggested (it already exceeds the Free ceiling rather than merely brushing it) and has no identified code mitigation so far.

## Full-parity decision (2026-07-26, the day's second decision)

The user explicitly decided to widen the scope to every Jikan route, replacing the earlier "only documented P0/P1" limitation. From here on, every new route group (manga, characters, people, clubs, producers, seasons, watch, recommendations, reviews, magazines, schedules, anime/manga search) is implemented incrementally, in batches, keeping the same per-route quality bar already used for the anime catalog (a real probe of the MAL page, a synthetic fixture based on real structure, a parser with defensive fallbacks for MAL label variations, unit+benchmark+integration tests, a response contract). Work in progress — see per-batch progress in the sections above and in the implementation changelog.

### Plan upgrade decision (2026-07-26)

The user decided to upgrade to the Workers Paid plan ($5/month, the CPU ceiling rises from 10ms to 30s by default). That removes the original justification for several CPU blocks documented in this file (person: detail at 9ms, upcoming season at 12ms, a Sunrise-scale producer at >1MB). **Important:** it does not affect the `genres/anime`/`genres/manga` block (MAL serving a reduced taxonomy to Cloudflare's network) — those are problems of different natures (CPU vs. content reduced by network origin).

### Batch — User search; club search reconfirmed blocked (2026-07-26)

`GET /v1/users?q=&page=` implemented after real reconnaissance refuted the initial assumption of "no approved source": `users.php?q={query}` genuinely filters server-side — I compared the results of `q=amaya` and `q=kenshin` and there was no username overlap at all, confirming real filtering (not a fixed popularity fallback). Three response shapes were mapped and handled: (1) a partial match → a "User Search Results" page with a paginated list (24/page, `<td align="center"  class="borderClass">` blocks); (2) an exact username match → MAL answers 303 and redirects straight to the profile page (`MalClient` already follows redirects, so the parser detects that shape and returns a 1-item list by reusing `parseUserProfile` without duplicating regexes); (3) zero matches → MAL's native 404, with no "popular results" fallback (unlike anime/manga search) — the Worker passes the 404 through faithfully.

**Club search**: a fresh investigation (not merely a repeat of the earlier attempt) found the root cause of the previously documented "suspicious response". `clubs.php?q=X` always returns the SAME list of clubs regardless of the query — verified by comparing the `cid`s extracted from `q=anime`, from a nonsense query, and from no query at all: the three sets are byte-for-byte identical. Inspecting the clubs page's HTML, the real search field uses a Vue component (`v-model="keyword"`, `@keydown.enter.prevent="jump()"`) that dispatches to an incremental search via an internal MAL endpoint — there is no server-side URL parameter that filters. Unlike the `genres/*` block (content reduced by network origin) or the Free CPU limit (already resolved), this is a structural block: implementing it would require depending on the internal search endpoint, which the project's rules explicitly forbid. It stays out of scope until there is a decision to maintain a club index of our own (outside direct scraping).

### Batch — Anime/manga moreinfo; userupdates investigated and declined (2026-07-26)

`GET /v1/anime/:id/moreinfo` and `GET /v1/manga/:id/moreinfo` implemented via `/{type}/:id/x/moreinfo`. The real content: free-form curation text (`<h2 class="mb8">More Info</h2>` followed by loose HTML with `<b>`/`<br />`) — a suggested watch order, related prototypes, trivia, expired licensing notices and so on. Confirmed by testing multiple real IDs in production that MOST titles do not have this section (Naruto, among others, returned `null`), so the parser treats the absence of the header as a valid result, not an error.

**`/v1/anime/:id/userupdates` and `/v1/manga/:id/userupdates` investigated and declined, with real evidence**: a byte comparison between `/anime/1/Cowboy_Bebop/userupdates`, `/anime/1/Cowboy_Bebop` (the detail) and `/anime/1/Cowboy_Bebop/totallybogussubpage` (a deliberately invalid sub-path) showed all three with essentially identical size and title (~200KB, a title with no distinguishing suffix) — confirming that `userupdates` is not a real MAL route, only the already-documented silent fallback for unrecognized sub-paths (the same pattern as this session's character/person news bug). The same test repeated for manga (`Berserk`) confirmed the same behavior. Unlike `moreinfo`, which has a genuine and distinctive content marker, `userupdates` has nothing to extract — implementing it would return detail-page data disguised as "user updates", which would be misleading. Decision: do not implement until there is evidence of a real corresponding page on MAL.

A side note from the reconnaissance: during that investigation, MAL returned some transient 504 Gateway Timeouts on consecutive requests — resolved simply by waiting ~15s before trying again; it is not a block, it is momentary instability at the origin server (possibly related to the request volume of this long session).

### Batch — Per-title anime/manga recommendations and reviews (2026-07-26)

`GET /v1/anime/:id/recommendations`, `/v1/manga/:id/recommendations`, `/v1/anime/:id/reviews` and `/v1/manga/:id/reviews`. Real reconnaissance of the links on the detail page itself (`/anime/1/Cowboy_Bebop`) confirmed the real URLs: `/{id}/{slug}/userrecs` (recommendations) and `/{id}/{slug}/reviews` — both work with the placeholder slug `x` already used by other `/x/{resource}` routes.

**Per-title recommendations have a different structure from the global list** (`recommendations.parser.ts`, which expects `raArea1_`/`raArea2_` pairs because it mixes arbitrary works): here one side of the pair is already fixed (the title itself), so each card only shows the recommended work. A new parser (`title-recommendations.parser.ts`) extracts `{malId, title, imageUrl, votes}`, with `votes = 1 + N` when the "Read recommendations by N more users" link is present — confirmed that the absence of that link means exactly 1 vote (not 0, since there is always at least the initial visible comment). Tested with Cowboy Bebop (166 recommendations, e.g. Samurai Champloo with 122 votes) and Berserk (138 recommendations) in production.

**Per-title reviews almost reused the wrong parser**: the per-title page (`/anime/1/Cowboy_Bebop/reviews`) uses the SAME card marker (`review-element js-review-element`) as the global list, but **does not link back to the title being reviewed in each card** (`class="title ga-click"`, used by the global parser to extract `malId`/`title`, has a count of zero on that page) — reusing `parseReviews` unadjusted would leave `title` empty on every row, failing Zod validation (`title: z.string().min(1)`) and returning an empty list for EVERY review, raising an "empty page" error even with real data present. Discovered BEFORE writing the parser, through reconnaissance (`class="title ga-click"` count = 0 on the real page), avoiding reproducing that bug. A new dedicated parser (`title-reviews.parser.ts`) reuses the same field extraction as the global parser (user, avatar, date, tag, score, text — including the `reviewText` boundary fix documented earlier), just without trying to extract `malId`/`title`. Native pagination via `p=`, confirmed real by comparing distinct users between pages 1 and 2 in production.

### Batch — Top characters; top reviews investigated and declined (2026-07-26)

`GET /v1/top/characters?page=` — the same pattern as `top/people`: `character.php` without `q=` is the real "Characters" ranking by favorites (`class="characters-favorites-ranking-table"`, `ranking-list` rows), with native pagination via `limit=`. Two extra columns confirmed on the real page (animeography/mangaography, each with multiple `<div class="title"><a>`), extracted as `{malId, title}[]` — without image or role, which already exist via `/v1/characters/:id/anime`. Tested with Lelouch Lamperouge (#1, 180,332 favorites) and Monkey D. Luffy (#2) in production, matching the real page exactly.

**`/v1/top/reviews` investigated and decided NOT to implement, with evidence**: the probe matrix entry already flagged "confirm the ordering semantics" as pending. Real reconnaissance of `reviews.php?t=anime` showed: (1) no sort parameter by helpfulness/votes exists — only a sentiment filter (Recommended/Mixed Feelings/Not Recommended) via JS/checkbox, with no "most helpful first" equivalent; (2) the date field (`class="update_at"`) has only day granularity (`"Jul 26, 2026"`), repeated across multiple reviews from the same day — making even an honest attempt to interleave the anime and manga feeds by date into a single endpoint unworkable. Implementing `/v1/top/reviews` under those conditions would be a redundant alias of `/v1/reviews/anime`/`/v1/reviews/manga` disguised as a route with semantics of its own. Decision: do not implement until there is evidence of a real ranking mechanism on MAL.

### Batch — Top people (2026-07-26)

`GET /v1/top/people?page=` — closes the People group. Real reconnaissance confirmed that `people.php` (the same URL whose `?q=` search attempt is already documented as unviable — see "Batch — User search; club search reconfirmed blocked") with no `q` parameter becomes a real ranked listing by favorites: `class="people-favorites-ranking-table"`, `<tr class="ranking-list">` rows — the same row class already used by `topanime.php`/`topmanga.php`. Native pagination via `limit=` (confirmed by `<link rel="next" href=".../people.php?limit=50" />`), unlike the `show=` used exclusively by the search — the two parameters do not mix because search and ranking are, in practice, two distinct modes of the same base URL.

Fields extracted: name, name in kanji/the original alphabet (`(神谷 浩史)`), image, birthday, favorites — with no explicit rank position in the payload (the array's order already reflects the ranking, the same pattern as `AnimeListEntry`/`MangaListEntry`). Validated with real data in production: page 1 led by Hiroshi Kamiya (108,566 favorites), page 2 with favorites in a much lower range (~16,000), confirming real pagination rather than repetition.

**This closes the People group (7/7 routes of the Jikan inventory)**: detail, full, search, anime, manga, voices, pictures/news (a bonus beyond the official inventory) and now top — alongside the Characters group already closed in the previous batch.

### Batch — Full for characters and people (2026-07-26)

`GET /v1/characters/:id/full` and `GET /v1/people/:id/full` — these close both groups. Unlike anime `full` (which needed a new parser for openings/endings) or producer `full` (which needed to extract `about`/`external` that did not exist before), here **no real field was left to add**: the character and person `anime`/`manga`/`voices` parsers were already implemented and tested in the earlier batches. `full` just reuses those same parsers over the HTML of ONE fetch (the same URL as `detail()`) and returns everything combined — avoiding four separate requests (`detail` + `anime` + `manga` + `voices`) for anyone who needs the complete package at once, with its own cache key in `catalog_lists` (it does not reuse the existing `detail()`/`media()` keys, the same isolation pattern used in `producer.full()`).

Validated by comparing the `full` counts against the individual routes already tested in production: character Spike Spiegel (3 anime, 2 manga, 14 voice actors — an exact match with the previous batch) and person Kouichi Yamadera (6 staff positions, 0 manga, 591 voice roles — likewise). This closes the Characters group (7/7 routes of the Jikan inventory) and leaves People with only `top/people` pending.

### Batch — Per-person anime/manga/voices (2026-07-26)

`GET /v1/people/:id/anime`, `/manga` and `/voices`. Real reconnaissance of the person detail page confirmed three sections: "Voice Acting Roles" (voice actor), "Anime Staff Positions" (director/screenwriter/etc.) and "Published Manga" (mangaka) — all on the same URL already used by `detail()`. Unlike the character page, here the three tables use different row CSS classes and are always present in the document even when empty (`class="js-people-staff"`, `class="js-people-manga"`, `class="js-people-character"`) — MAL even shows the literal message "No voice acting roles have been added to this person." when there are none, confirmed on a person who is only a director (Shinichirou Watanabe, id 2009). That means **the row's own class already identifies which table it belongs to**, so the parser does not need to find each section's boundaries — it just filters by row marker across the whole document.

The `anime`/`manga` row structure: image + title link + a `<small>` with comma-separated positions (e.g. "Production Manager, Production Assistant"; a mangaka's "Story & Art" stays a single item, without splitting on the "&"). `voices` has a richer structure: the row splits into an "anime" half (image+title) and a "character" half (name, Main/Supporting role, image) — the parser locates the `align="right" nowrap"` that marks the start of the character half and applies different regexes to each half.

Tested with three real profiles of very different natures before the deploy: Kouichi Yamadera (a prolific voice actor, 591 voice roles — validating robustness at large scale), Shinichirou Watanabe (a director, 48 staff positions, zero voice roles) and Eiichiro Oda (a mangaka, 16 published manga). It confirms that all three parsers handle large lists well, and the total absence of one of the three categories.

### Batch — Per-character anime/manga/voices (2026-07-26)

`GET /v1/characters/:id/anime`, `/manga` and `/voices`. Real reconnaissance of the character detail page (`/character/1/Spike_Spiegel`) confirmed three sections on the same page: `<div class="normal_header character-anime">Animeography</div>`, `<div class="normal_header character-manga">Mangaography</div>` and `<div class="normal_header">Voice Actors</div>` — all with a URL identical to the one already used by `detail()`, so the three routes reuse a single fetch (the same pattern as anime's `characters`/`staff`: a shared private `charactersAndStaff()`). Animeography and mangaography have exactly the same row structure (image + link + a `<small>` with the "Main"/"Supporting" role), only swapping `/anime/` for `/manga/` in the href. Voice Actors uses a separate `<table>` per voice actor (one per language) rather than rows inside a single table.

Tested with Spike Spiegel (character id 1): 3 anime, 2 manga, 14 voice actors in production — confirming that the parser handles realistically sized lists, not just the fixture's minimal case. None of the three parsers throws on an empty list — a character can legitimately have no mangaography (an original) or no animeography (existing only in manga), and secondary characters may have no credited voice actor.

### Batch — Full for anime and manga (2026-07-26)

An analysis of what Jikan's `full` schema really adds over the base detail (`relations`, `theme` with openings/endings, `external`, `streaming`) showed that, in this project, `AnimeDetail`/`MangaDetail` **already carry `relations`, `externalLinks` and (anime only) `streaming`** from the original implementation — because MAL's real page exposes all of it in a single document, and the project chose to embed those fields in the base detail rather than reserving them for a separate `full` route (unlike official Jikan, which deliberately separates them for response-cost reasons). That left only one real piece of `full` missing for anime: the openings/endings (theme song names).

`GET /v1/anime/:id/full` reuses `parseAnimeDetail` and adds `themeSongs: { openings, endings }`, extracted from the page's real "Opening Theme"/"Ending Theme" sections (`<h2>Opening Theme</h2>` followed by `<div class="theme-songs js-theme-songs opnening">` — note MAL's own typo in "opnening"). Each song comes in a `<td width="84%">` cell with `theme-song-title`/`theme-song-artist`/`theme-song-episode`. **An important finding from the real reconnaissance**: the numeric index (`<span class="theme-song-index">1:</span>`) only appears when there are 2+ songs in the section — with a single-song section (e.g. Cowboy Bebop's opening, only "Tank!"), MAL omits the numbering entirely. That is why the parser does not depend on that index to split the entries; it uses `theme-song-title` as the marker (always present) and derives the order from the array position. Tested with Cowboy Bebop (1 opening, 3 endings) and Naruto (8 openings, 14 endings) to validate robustness with long series before the deploy.

`GET /v1/manga/:id/full` is a pure alias of `MangaService.detail()` — no new fetch, no new parser, no new cache key. The justification: manga has no concept of openings/endings or streaming in Jikan, and `relations`/`externalLinks` have always been in `MangaDetail`, so there is nothing real left for a distinct `full` route to add.

### Batch — Character and person search (2026-07-26)

`GET /v1/characters?q=&page=` and `GET /v1/people?q=&page=`. Real reconnaissance confirmed that, unlike `clubs.php`, both `character.php?q=` and `people.php?q=` genuinely filter server-side: two distinct real queries ("spike" vs "naruto", "miyazaki" vs "yamadera") return ID sets with zero overlap — verified before writing any parser. Native pagination in blocks of 50 (`show=50`, `100`, `250`), the same scheme as `anime?q=`/`manga?q=` — `searchUrl()` in `mal-urls.ts` was generalized to accept `'character' | 'people'` alongside `'anime' | 'manga'`, without needing a new URL function.

Zero-result behavior differs between the two, so each has its own handling: `character.php` answers a plain HTTP 404 (the same pattern as `users.php`, with no popularity fallback), while `people.php` answers 200 with the literal marker "No results returned" in a table with no data rows — the people parser checks that marker first and returns an empty list, avoiding an incorrect `ParserError` for an "empty page" in a situation that is actually a valid response with no results.

Row structure: characters use `<tr>` with `bgColor1`/`bgColor2` zebra striping and a 3rd column with associated anime/manga (not extracted — out of this route's scope); people use simpler `<tr>` rows, with no striping and no extra column, with relative hrefs (`/people/{id}/{slug}`) instead of absolute ones as in `character.php`. Both parsers take the `malId` from the row's first link (the image) and the name from the second link (the one with text), since the image link has no text between the tags and therefore does not match the `[^<]+<\/a>` pattern used to capture the name.

Validated locally and in production with real data before the deploy: `spike`/`naruto` (characters), `miyazaki` (people, with results) and a nonsense query for people (200, an empty list, confirming the parser does not throw).

### Batch — Club index; producer full/external (2026-07-26)

`GET /v1/clubs?page=` implemented using the same URL as the search attempt (`clubs.php`), now without `q=` — it returns MAL's real default listing, with native pagination via `p=` (not `show=`, confirmed by comparing the `cid`s of `p=1` vs `p=2`: distinct, except for a fixed block of "featured clubs" that repeats at the top). The row structure (`<tr class="table-data">`) is the same one already used by the failed club search, so the parser reuses that reconnaissance knowledge.

`GET /v1/producers/:id/full` and `GET /v1/producers/:id/external` implemented. Real reconnaissance of the producer detail page (`/anime/producer/1/Studio_Pierrot`) revealed two sections the original detail parser did not capture: a description paragraph (`about`) right after "Member Favorites", and two link sections (`<h2>Available At</h2>` with the official site/social networks, `<h2>Resources</h2>` with wikis/aggregators). `full` reuses `parseProducerDetail` internally and adds those two fields via a separate parser, stored in `catalog_lists` under its own key (it does not alter the `producers` table or the `/v1/producers/:id` contract, avoiding any risk of cache invalidation on already-stored rows). `external` projects the field with no new fetch.

**A real bug discovered through production validation (not hypothetical)**: several `href`s in the "Available At"/"Resources" sections carry a literal carriage return byte (`0x0D`) before the closing quote — confirmed by inspecting the raw bytes of MAL's response (`href="http://pierrot.jp/` followed by byte `0d` and then `"`). The original regex captured that `\r` as part of the URL; `z.string().url()` did not catch the problem because JavaScript's `URL` constructor discards tab/CR/LF during its own internal normalization without that affecting the original stored string — validation passes, but the saved data is dirty. Fixed by stripping `\t`/`\r`/`\n` from the captured URL before Zod validation. Discovered and fixed during local validation with `dev:local` against the real producer "Studio Pierrot" (id 1), before the deploy — reinforcing the value of testing against real MAL HTML rather than trusting synthetic fixtures alone.

### Batch — Per-club members and staff (2026-07-26)

`GET /v1/clubs/:id/staff` (derived from the already-fetched `ClubDetail` — the `staff` field has existed since the detail's original implementation) and `GET /v1/clubs/:id/members?page=`. Real investigation via direct fetch: the club detail page (`clubs.php?cid=:id`) links `clubs.php?id=:id&action=view&t=members` for the member list — note: that link uses the `id` parameter, different from the `cid` used in the detail URL (confirmed, both resolve the same club). The row structure is identical to `users.php?q=` (the same `<td align="center"  class="borderClass">` block marker, the same avatar pattern via `picSurround`/`data-src`), only without the join-date field — MAL's native pagination in blocks of 36 (`show=36`, `72`, ...; confirmed via `<link rel="next" ... show=36 />` on the page itself). Tested with the real club `cid=1` ("Cowboy Bebop"), ~1,404 members across 39 pages. Validated locally and in production before the deploy: page 1 and page 2 return distinct members (real pagination, not repetition).

### Batch — Per-character/person pictures and news (2026-07-26)

`GET /v1/characters/:id/pictures`, `GET /v1/people/:id/pictures` and `GET /v1/people/:id/news`. Real reconnaissance (not assumption) done before coding: the navigation links present on the character detail page itself (`/character/1/Spike_Spiegel`) only point at `/featured` and `/pics` — **no news or forum page for characters**. The person page (`/people/1/Tomokazu_Seki`) only links `/news` and `/pics` — **no forum for people**. Also confirmed by the fallback: any unrecognized sub-path under `/character/:id/x/` or `/people/:id/x/` returns 200 with MyAnimeList.net's generic home page (not a 404), which would have silently masked a parser applied to the wrong place — `/character/1/x/news`, for example, "parsed" as if it had news because the generic home page carries a site-wide "Recent News" sidebar widget with no relation to the character.

`parsePictures`/`parseNews` were reused with no parser change at all — only new URLs (`picturesUrl`/`newsUrl` in `mal-urls.ts` gained `'character'`/`'people'` in their type union). A finding with no impact on the result: the person pictures page has each `js-picture-gallery` duplicated in the HTML (grid cell + hover preview, the same URL); the parser's regex only matches the first occurrence of each (strict `<a>...<img data-src>` adjacency), so the final result already reflects the count of unique images with no explicit dedup needed — verified by comparing the returned URL list (8 unique) against the raw marker count in the HTML (16, that is, 2×8).

### Batch — Per-title statistics, pictures, news, forum and episodes (2026-07-26)

This completes the group of title-derived routes: `GET /v1/anime/:id/statistics`, `/pictures`, `/news`, `/forum`, `/episodes` and `GET /v1/manga/:id/statistics`, `/pictures`, `/news`, `/forum` (manga has no episode-by-episode page on MAL). All use the same fixed-slug URL pattern already established in `characters` (`/{type}/{id}/x/{resource}`) and reuse `catalog_lists` — no new migration.

- **Statistics** (`/x/stats`): status distribution (`dark_text` with the labels `Watching`/`Reading` and `Plan to Watch`/`Plan to Read` as anime/manga variants) and score distribution (`score-label score-N` + `width: N%` + `(N votes)`). Verified in production with real data: Cowboy Bebop (2,074,721 members) and Berserk (804,286 members).
- **Pictures** (`/x/pics`): the `js-picture-gallery` gallery, `imageUrl`/`thumbnailUrl` via `data-src`.
- **News** (`/x/news`): items via the `picSurround` marker, with title/excerpt/date/author fields.
- **Forum** (`/x/forum`): topics via `data-topic-id`, with author/date/replies/last post.
- **Episodes** (`/x/episode`, anime only): `episode-list-data` rows; romanized and Japanese titles, air date, mean score and replies in the episode's forum. **Only the first page is fetched** — MAL's pagination parameter format for long series was not confirmed in this round, so series with many episodes (e.g. anime with 50+) return only the first ones. Documented as a known simplification, not a bug.

All 5 parser families passed the fixture tests on the first attempt (no production bug discovered, unlike several earlier routes in this cycle). Validated locally against real MAL HTML and then in production (`https://jikan-edge.lucas-hdo.workers.dev`) for anime id=1 and manga id=2 before the deploy was considered complete.

### Batch 3 — Clubs and seasons (2026-07-26)

`GET /v1/clubs/:id` — the real page is ~66KB, with fields in `<span class="dark_text">` (Members/Pictures/Category/Created) and a staff list via `<a href="/profile/...">`. A real care confirmed: the club page contains a Vue template with the text `Members: ${ item.payload.members }` used by MAL's global search widget — the parser uses the pattern `Members:</span>` (with the closing tag) so it does not confuse it with that template.

`GET /v1/seasons/:year/:season` and `GET /v1/seasons/upcoming` — they reuse the `seasons/now` parser (`parseSeasonNow`) unchanged, since `/anime/season/{year}/{season}` and `/anime/season/later` use exactly the same `js-seasonal-anime` card structure. Note: the real URL for "upcoming season" is `/anime/season/later`, not `/anime/season/upcoming` (which returns 404) — Jikan's old naming no longer matches MAL's current URL. The "later" page is large (~1.8MB, 434 cards before dedup) — within budget now that the plan will be paid.

### Batch 2 — Manga (2026-07-26)

Implemented by mirroring the anime catalog's architecture: `GET /v1/manga/:id` (detail), `GET /v1/top/manga?page=` (ranking), `GET /v1/genres/manga` (taxonomy — **blocked**, the same Cloudflare network problem described above). MAL's real structure for manga differs from anime's at specific points: the title is in `<span class="h1-title"><span itemprop="name">` (not `<h1 class="title-name">`), the synopsis in `<span itemprop="description">` (not `<p itemprop="description">`), and the fields are `Volumes`/`Chapters`/`Published`/`Authors`/`Demographic`/`Serialization` instead of `Episodes`/`Aired`/`Studios`/`Duration`/`Rating`/`Source`. No season route (there is no concept of a season for manga in Jikan).

## Outside the current commitment (historical, predating the full-parity decision above)

The project does not promise to implement all 100 routes. This list avoids losing coverage and makes it possible to decide, with evidence, which subsets have enough technical viability and value.
