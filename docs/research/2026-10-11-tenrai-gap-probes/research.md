---
tags: [research, area/data, 2026-10-11-tenrai-gap-probes]
status: active
decided: 2026-10-11
---

# Can the gaps the Tenrai comparison exposed be closed from the pages this API already reads?

> Yes, for every in-scope item, and without a fetch per entry. Two of the refusals in
> `QUERY_CONTRACT` rest on premises the pages contradict, and the audit found two more production
> defects: the anime synopsis is cut by a 90 KB window, and manga `type=novel` asks MAL for light novels.

## What was blocking

[[tenrai-comparison-gaps]] left eleven questions under Research Needed. Ten are about how MyAnimeList
answers. The eleventh is how to produce an OpenAPI document. Each MAL question was settled by fetching
the real page **through Cloudflare's network**: a throwaway `wrangler dev --remote` probe in colo POA,
sending the production `MAL_USER_AGENT`. The genre taxonomy already showed that a page fetched from a
laptop is not evidence of what the Worker receives. 68 pages were fetched, all in colo POA, between
17:49 and 17:57 UTC.

Every number below is **measured** unless the row says otherwise.

## Findings

### 1. The fixed byte windows: two of eight parsers cut real pages

Eight detail parsers keep a `slice(0, N)` prefix and run their regexes over it. For each one, the
furthest anchor it needs was located on pages picked to be large (`fetches/mal-detail-windows.md`,
`fetches/mal-character-detail.md`):

| parser | window | worst page measured | last anchor ends at | result |
| --- | ---: | --- | ---: | --- |
| `character-detail` | 60,000 | `/character/40` | 120,022 | **cut on 5 of 6 pages** |
| `anime-detail` | 90,000 | `/anime/1735` | 110,660 | **cut on 3 of 3 pages** (synopsis) |
| `user-profile` | 30,000 | `/profile/Xinil` | 33,953 | past the window, covered by the `<title>` fallback |
| `statistics` | 120,000 | `/anime/21/x/stats` | 96,102 | 23,898 B margin |
| `person-detail` | 60,000 | `/people/118` | 36,088 | 23,912 B margin |
| `producer-detail` | 60,000 | `/anime/producer/141` | 33,362 | 26,638 B margin |
| `club-detail` | 60,000 | `/clubs.php?cid=1` | 28,684 | 31,316 B margin |
| `manga-detail` | 90,000 | `/manga/2` | 49,155 | 40,845 B margin |

Production confirms both cuts (`fetches/production-api-probes.md`):
- **Characters:** `nameKanji`, `favorites` and `about` are null for 5 of 6 characters, the same five
  whose fields sit past 60 KB.
- **Anime:** `synopsis` is null for One Piece, Detective Conan and Naruto Shippuuden.

**The anime synopsis was not in the pitch.** The Tenrai sweep compared array counts, so a null text
field never showed up as a difference.

The windows exist for a reason that is not written down. A regex pass over 300 KB costs more CPU than
over 90 KB, and the Free plan allows 10 ms. So the fix is **bounds relative to an anchor**, not deleting
the window: cut from a field's own marker to its closing tag, which is the pattern `parseStaff` and
`backgroundSection` already follow.

### 2. The episode list paginates with `?offset=N`

`/anime/21/x/episode?offset=100` returns episodes 101–200, at 100 per page (`fetches/mal-episode-list.md`).
The pager on page 1 links the last block (`offset=1100`; One Piece has 1,180 episodes, 12 pages). An
offset past the end answers **200 with zero rows**.

Filler rows carry `<span class="fl-r di-ib pr4 icon-episode-type-bg">Filler</span>` before the title
anchor. Page 1's 11 Filler rows are exactly the 11 episodes production drops.

### 3. Search can carry four more columns at no extra cost

Adding `c[]=a…g` to the same search request adds `Start Date, End Date, Members, Rated` for anime, and
`Chap., Start Date, End Date, Members` for manga. Measured at the edge (`fetches/mal-search.md`). The
column letters come from MAL's own form (`fetches/mal-search-form.md`).

### 4. Reviews: MAL filters preliminary and spoiler itself, and production hides spoilers today

The per-title and global review pages both accept `preliminary=on|off` and `spoiler=on|off`
(`fetches/mal-reviews.md`).
- MAL's defaults are preliminary **on** and spoiler **off**. This API sends no parameter, so **every
  spoiler review is silently omitted today**.
- On One Piece, `preliminary=off` returns 0 reviews. That is exactly Tenrai's (and Jikan's) default
  output.

Each review element also carries:
- its id, in `reviews.php?id=N`;
- `<div class="tag preliminary">Preliminary <span> (344/? eps)</span>`, which gives the progress at
  review time;
- `<div class="tag spoiler">`, when spoilers are requested;
- the reactions, as `data-reactions='{"icon":[…],"num":6056,"count":[7 values]}'`.

The reaction positions map to the buttons' `data-val` 1–7 (nice, love it, funny, confusing,
informative, well-written, creative). Position 6 was inferred here and then read during the
implementation, from the same fetched page: `review-anime-reaction-well-written` carries `data-val="6"`.

`QUERY_CONTRACT` refuses `preliminary` and `spoilers` with "MyAnimeList does not separate preliminary
reviews on the public pages" (`src/http/query-contract.ts:178-179`). **The pages contradict that premise.**

### 5. Character name: `og:title` plus the `<h1>`, but no family-first form

The detail page gives the plain name as `og:title` (`Luffy Monkey D.`), and the nicknames as the quoted
segment of the `<h1>` (`Luffy "Mugiwara, Straw Hat" Monkey D.`). The family-first form that
`top/characters` and Tenrai return (`Monkey D., Luffy`) appears on the detail page only inside a
sidebar ranking widget, so only for ranked characters (`fetches/mal-character-detail.md`).

### 6. Seasons: the continuing block is on the page, and so are `kids` and `r18`

Season pages group cards under `<div class="anime-header">`, and one of those headers is
`TV (Continuing)`: 45 of 165 cards on `/anime/season`, One Piece among them (`fetches/mal-season.md`).
Cards also carry `kids` and `r18` in their class list (26 and 13 on the same page).

Tenrai's `seasons/now` total is 120: the 165 cards minus the 45 continuing ones. That is Jikan's
documented default ("when supplied it will include entries which are continuing",
`fetches/jikan-openapi.md`).

`QUERY_CONTRACT` refuses `kids` and `continuing` with "no equivalent switch on the public pages"
(`:180-181`). **The page contradicts that premise too.**

### 7. Telling "nothing there" from "MAL failed" takes one fetch

| case | MAL answers | distinguishable by |
| --- | --- | --- |
| search, zero results | 404, full search page, "No titles that matched your query were found." | the body |
| search or top list, page past the end | 404, generic page, `<h1 class="h1">404 Not Found</h1>` | context: `page > 1` |
| nonexistent anime | 404, the same generic page | it is a detail route |
| nonexistent character | **200**, `<div class="badresult">Invalid ID provided.</div>` | the body |
| nonexistent club | 404, `<h1>Invalid</h1>` | status (production already answers 404) |
| nonexistent episode | **200**, titled "Episode 99999" | the body: `<div class="badresult al"> Sorry, this anime doesn't seem to have any episode information yet.` and an empty title in the heading |
| episode list past the end | 200, zero rows | row count |

`src/source/response-validator.ts:10` returns `not_found` on any 404 **without the body**. So the
zero-results case needs the body kept for search routes, which is a change in the source layer, not
only in the service.

### 8. A query under three characters works when quoted

`q=86`, `q=ab` and `q=86 ` all come back as zero results. `q="86"`, quoted, returns the four *86* titles
Tenrai returned, for anime and for manga. `"ab"` and `"K"` return substring matches (*Made in Abyss*,
*K-On!*). Quoting is a usable fallback for queries under 3 characters only; above that the plain query
keeps MAL's normal matching.

### 9. Search types: `cm`, `pv` and `tv_special` exist, and `novel` is mapped wrong

Measured by the type column of the results (`fetches/mal-search.md`):
- **Anime:** `type=7` returns CM, `8` returns PV, `9` returns TV Special.
- **Manga:** `type=2` is **Light Novel** and `type=8` is **Novel**. `ANIME_TYPE_MAP` stops at `music`.
  `MANGA_TYPE_MAP` maps `novel: '2'` (`src/services/search.service.ts:45`), so **`type=novel` returns
  light novels today**.
- **Manga status:** `4` (On Hiatus) and `5` (Discontinued) exist and narrow the result. Whether they
  return only those statuses is not checked entry by entry.

### 10. The search form's producer dropdown is a complete public producer list

`<select name="p">` on `/anime.php` has **2,833** producers (ids up to 3,412), including all five
"Toei" entries Tenrai returned (`fetches/mal-search-form.md`). The directory `/anime/producer`, which
`producers?q=` filters today, links 930 and lacks Toei Video (141). The dropdown carries id and name
only, so it can back the search but not replace the directory's counts.

The manga form's `<select name="mid">` lists 1,499 magazines. Production returns 1,457 and Tenrai 1,474.

### 11. OpenAPI generation: a committed file, generated in a test, with no route rewrite

This part was delegated. Its prototypes ran on copies of the repo in the scratchpad, and nothing in
`src/`, `tests/` or `package.json` was touched. The counts below were re-checked against the repo
(66 schema constants in 46 parser files, 3 exported; zod imported nowhere outside `src/parsers/`;
zod 3.25.76 and hono 4.13.5 installed).

**The schemas cover `data` for most routes, and the envelope not at all.**

| coverage of `data` across the 97 `/v1` routes | routes |
| --- | ---: |
| one existing schema (or an array of one) describes it | 79 |
| buildable from existing schemas; no container schema yet (`anime/:id/full`, `schedules`, `clubs/:id/relations`, …) | 8 |
| no schema at all: user statistics, favorites, userupdates, full; both `moreinfo`; the four `random/*` | 10 |

- **The envelope.** `{ data, meta }` types `meta` as `Record<string, unknown>`. The error body
  `{ error: { code, message, requestId } }` is built at six sites, with no schema and no central list
  of codes.
- **A caveat.** The schemas describe *parser output*. Payloads read back from D1 are not
  re-validated, so a document generated from them describes what was parsed, not what is served.

**`QUERY_CONTRACT` gives names, not types.** A prototype read `app.routes`, `QUERY_CONTRACT` and a
route → schema table, and produced 98 paths with none missing. Redocly 2.60.0 validated it as
OpenAPI 3.1 with zero errors. The value lists (`ANIME_TYPE_MAP`, `ORDER_BY_MAP`, …) are private
constants in the services, and per-route error codes are declared nowhere. Both would need exporting
or declaring.

**Generators** (versions from the npm registry; prototype outcomes measured):

| candidate | version usable today | route rewrite | outcome |
| --- | --- | --- | --- |
| `@asteasolutions/zod-to-openapi` | 7.3.4 (peer `zod ^3.20.2`; last release 2025-06-13, "we do not intend to actively support that version going forward") | **no**, separate registry | 98 paths, valid. 9.1.0 on zod 4 produced byte-identical output |
| `@hono/zod-openapi` | 0.19.10 (1.x needs zod 4) | **yes**: `OpenAPIHono` + `createRoute` for every route | not prototyped; rewrite cost ruled it out |
| `chanfana` | 2.8.3 (3.x needs zod 4) | **yes**: one `OpenAPIRoute` class per endpoint | its CLI extracts the file from a running `wrangler dev` |
| `zod-openapi` (samchungy) | 4.2.4 (5.x/6.x need v4 schemas) | no | 6.0.2 valid |
| native `z.toJSONSchema` | the `zod/v4` subpath already inside 3.25.76 | no, ~30 lines of glue | valid, different style (`additionalProperties: false`, nullable as `anyOf`) |

**A zod upgrade is cheap in code and costly in bundle.** Moving 46 imports to `zod/v4`, or swapping in
the zod 4.6.5 package, gave zero new `tsc` errors and 355/355 tests passing. The bundle grows from
478 KiB to 761 KiB (subpath) or 1,123 KiB (package), mostly locales. That is far under the 64 MiB
limit, but the effect on startup time was not measured.

**Where the document should live.** Recommended: a committed `site/openapi.json`, written and checked
by a vitest test with `toMatchFileSnapshot`, plus a coverage test that every GET route appears in it.
Measured in the prototype: with `CI=1` the test fails when the file is missing or has drifted, and a
`min(1)` → `min(2)` change surfaced as a readable `minLength` diff. The file is 335 KB pretty-printed.

The alternatives lose for measured reasons:
- **Runtime generation** took 14–15 ms of CPU cold in Node. The Free plan allows 10 ms per
  invocation.
- **Build-only generation** has no place to run: Workers Builds deploys the commit, and this repo has
  no build step.
- **A static asset comes back without CORS headers** (measured locally), so the committed file needs a
  `site/_headers` entry.

**Layering.** The route → schema table imports parser-layer schemas. Kept under `tests/`, it adds no
runtime edge. Moving the schemas into `src/domain/` would be the principled fix, but it puts zod in a
layer documented as "types and small pure helpers only".

### Two stale statements in this repo

- `.claude/CLAUDE.md` lists "a nonexistent club … currently becomes a 500 `UPSTREAM_SUSPICIOUS`" as a
  known follow-up. Production answers `404 NOT_FOUND` today.
- The four `UNSUPPORTED_PARAMS` messages above (`preliminary`, `spoilers`, `kids`, `continuing`) state
  source limitations that do not exist.

## Verdict

| pitch item | buildable? | how |
| --- | --- | --- |
| relations tiles + table | yes | already established in the pitch: 2 + 92 links on One Piece |
| character fields on long pages | yes | bounds relative to anchors, not a bigger prefix |
| **anime synopsis on long pages** (new) | yes | same |
| filler/recap rows and flags | yes | accept the `<span>` before the anchor and read its text |
| window audit | done here | two cuts; the rest have ≥ 23 KB margin |
| `richText` inline spacing | yes | no research needed |
| 200 `[]` on zero results and past the end | yes | keep the 404 body for search; treat a generic 404 on `page > 1` as the end |
| 404 for a missing character | yes | `Invalid ID provided` |
| 404 for a missing episode | yes | the `badresult` block, which episode 1 does not have |
| episode pagination | yes | `?offset=(page-1)*100`; last page read from the pager |
| search columns | yes | `c[]=` on the same request |
| review id, flags, reactions | yes | all on the element; filters map to MAL's own `preliminary`/`spoiler` |
| `alternateNames[]`, ISO birthday | yes | `, `-separated; `Mon DD, YYYY` with a double space |
| `nicknames` out of `name` | yes | `og:title` + the `<h1>` quote. One name format across routes is **not** possible from the detail page |
| `continuing` | yes | the `TV (Continuing)` block. The **default** is a decision, below |
| OpenAPI | yes | `@asteasolutions/zod-to-openapi` 7.3.4 as a devDependency, in a vitest test writing a committed `site/openapi.json`, plus `site/_headers` for CORS. It needs a route → schema table with its own coverage test, and schemas for the 10 routes that have none |

**Decisions this research cannot make, with the facts each needs:**

1. **`continuing` default.**
   - Follow Jikan and Tenrai (exclude unless passed): `seasons/now` goes from 165 to 120 entries, a
     breaking change for current consumers.
   - Keep MAL's page (include everything): add `continuing: true|false` per entry and a parameter to
     drop them.
2. **`preliminary` default.**
   - MAL's own default is on, and it is what consumers get today.
   - Jikan's is off, and gives 0 reviews for every airing show (One Piece: 0).
   - Spoilers are off in both, so changing nothing about spoilers keeps today's behaviour. The flag
     just becomes visible.
3. **Character `name`.** Keep the `<h1>` form minus the nicknames (`Luffy Monkey D.`) and accept that
   `top/characters` says `Monkey D., Luffy`, or carry both forms.

## What this does not establish

- **One colo.** Every page came through POA. MAL has served Cloudflare a truncated page before
  (genres); other colos were not tried.
- **Largest pages.** The window audit used pages picked as likely-large, not the maximum found by a sweep.
- **The CPU cost of anchor-relative bounds**, against the current prefix windows. Not measured.
- **An episode inside the announced count but with no data yet.** It probably also renders the
  `badresult` block, and would then answer 404.
- **Recap rows.** None appeared on the pages read.
- **Manga status 4 and 5.** Whether they return only those statuses.
- **OpenAPI at runtime on Cloudflare.** The in-Worker timer read 0 ms, so the only CPU figure is a
  Node measurement.
- **The zod 4 bundle's effect on Worker startup.**
- **The missing CORS header on static assets in production.** It was measured locally only.
- **`ts-json-schema-generator`**, generating from the domain interfaces, which would also cover the
  10 routes without a schema. Not evaluated.

## The strongest case against

- **Removing a window may cost the CPU budget it was protecting.** The corpus benchmark has detail
  pages at p95 27 ms on Paid, and Free allows 10 ms. That is why the verdict is anchor-relative bounds
  rather than parsing whole documents. If anchors prove brittle, the fallback of a larger prefix (the
  anime synopsis needs ≥ 111 KB, the character fields ≥ 121 KB) pays that cost on every page.
- **Treating a generic 404 on `page > 1` as "past the end" would also swallow a real MAL failure** on
  that page. The consumer sees the list end early, with a 200. The mitigation is to require the
  generic page's `404 Not Found` heading, but a MAL outage page that happens to carry it would pass.
- **Quoted short queries change the matching semantics** to substring. A Jikan user searching `ab`
  gets a different result set from Jikan's (when Jikan answers). The alternative is no result at all,
  which is what they get today.
- **The route → schema table is maintained by hand.** Pointing a route at the wrong schema fails
  nothing, and a committed document can ship stale: Workers Builds deploys every push to `main`
  whether or not CI passed. `@hono/zod-openapi` ties response types to handlers, which closes both
  holes, at the price of rewriting about 98 route definitions.
- **7.3.4 is a dead line.** It runs on a zod major with no release in 15 months. The byte-identical
  output from 9.1.0 means leaving it costs one dependency bump, not a new document.

## Sources
- [MAL character detail](https://myanimelist.net/character/40) — `fetches/mal-character-detail.md` — field offsets past 60 KB, name forms, the 200 for a missing id
- [MAL detail pages vs windows](https://myanimelist.net/anime/21) — `fetches/mal-detail-windows.md` — every other window, the anime synopsis cut, raw person fields
- [MAL episode list](https://myanimelist.net/anime/21/x/episode?offset=100) — `fetches/mal-episode-list.md` — `?offset=` pagination, Filler markup, the 200 for a missing episode
- [MAL search results](https://myanimelist.net/anime.php?q=frieren&cat=anime) — `fetches/mal-search.md` — `c[]` columns, zero-result and past-the-end 404s, quoted short queries, type and status values
- [MAL search forms](https://myanimelist.net/anime.php) — `fetches/mal-search-form.md` — type, status and column vocabularies, the 2,833-producer dropdown
- [MAL reviews](https://myanimelist.net/anime/21/x/reviews) — `fetches/mal-reviews.md` — server-side preliminary/spoiler filters, ids, tags, reactions
- [MAL season page](https://myanimelist.net/anime/season) — `fetches/mal-season.md` — the `TV (Continuing)` block, `kids`/`r18` classes
- [Jikan OpenAPI](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json) — `fetches/jikan-openapi.md` — documented defaults of `continuing`, `preliminary`, `spoilers`
- [Tenrai OpenAPI](https://api.tenrai.org/documentation/openapi.json) — `fetches/tenrai-openapi.md` — the competitor's interpretation of the same parameters
- [This API in production](https://jikan.lucashdo.com/v1/) — `fetches/production-api-probes.md` — null synopsis and character fields confirmed live; the club 404

OpenAPI generation (§11). The npm registry entries are registry documents, read for versions, peers
and dates:
- [@asteasolutions/zod-to-openapi on npm](https://registry.npmjs.org/@asteasolutions%2Fzod-to-openapi) — `fetches/openapi-npm-zod-to-openapi.md` — zod range per major, 7.3.4 as the last v3 release and "not actively supported"
- [zod-to-openapi 7.3.4 README](https://raw.githubusercontent.com/asteasolutions/zod-to-openapi/v7.3.4/README.md) — `fetches/openapi-github-zod-to-openapi-v7-3-4-readme.md` — `extendZodWithOpenApi`, registry-based paths, no route rewrite
- [@hono/zod-openapi on npm](https://registry.npmjs.org/@hono%2Fzod-openapi) — `fetches/openapi-npm-hono-zod-openapi.md` — 0.19.10 as the last zod v3 release; 1.x needs zod 4 and hono ≥ 4.10
- [@hono/zod-openapi README](https://raw.githubusercontent.com/honojs/middleware/main/packages/zod-openapi/README.md) — `fetches/openapi-github-hono-zod-openapi-readme.md` — the `createRoute`/`app.openapi` rewrite
- [@hono/zod-openapi 0.19.10 README](https://raw.githubusercontent.com/honojs/middleware/%40hono/zod-openapi%400.19.10/packages/zod-openapi/README.md) — `fetches/openapi-github-hono-zod-openapi-0-19-10-readme.md` — the same model on the zod v3 line
- [@hono/zod-openapi CHANGELOG](https://raw.githubusercontent.com/honojs/middleware/main/packages/zod-openapi/CHANGELOG.md) — `fetches/openapi-github-hono-zod-openapi-changelog.md` — 1.0.0 moved to zod v4
- [chanfana on npm](https://registry.npmjs.org/chanfana) — `fetches/openapi-npm-chanfana.md` — 2.x on zod 3, 3.x on zod 4; class-based endpoints
- [chanfana 2.8.3 README](https://raw.githubusercontent.com/cloudflare/chanfana/v2.8.3/README.md) — `fetches/openapi-github-chanfana-2-8-3-readme.md` — the class model on the zod v3 line
- [chanfana router adapters](https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/router-adapters.md) — `fetches/openapi-github-chanfana-router-adapters.md` — plain Hono routes stay undocumented
- [chanfana CLI](https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/cli.md) — `fetches/openapi-github-chanfana-cli.md` — the file is extracted from a running `wrangler dev`
- [chanfana migration to v3](https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/migration-to-chanfana-3.md) — `fetches/openapi-github-chanfana-migration-v3.md` — v3 means zod 4 plus zod-to-openapi v8
- [zod-openapi on npm](https://registry.npmjs.org/zod-openapi) — `fetches/openapi-npm-zod-openapi.md` — zod ranges for 4.x/5.x/6.x; 6.x needs OpenAPI ≥ 3.1
- [zod-openapi v5 migration](https://raw.githubusercontent.com/samchungy/zod-openapi/master/docs/v5.md) — `fetches/openapi-github-zod-openapi-v5-migration.md` — 5.x needs v4 schemas
- [hono-openapi on npm](https://registry.npmjs.org/hono-openapi) — `fetches/openapi-npm-hono-openapi.md` — Standard Schema based, "still in development"
- [honohub: OpenAPI](https://honohub.dev/docs/openapi) — `fetches/openapi-honohub-openapi.md` — zod v3 needs `zod-openapi@4` (read through a summarising fetch tool, so weaker than a direct read)
- [honohub: OpenAPI with zod](https://honohub.dev/docs/openapi/zod) — `fetches/openapi-honohub-openapi-zod.md` — `describeRoute` on a plain `app.get`, runtime handler
- [zod on npm](https://registry.npmjs.org/zod) — `fetches/openapi-npm-zod.md` — 3.25.76 as the last 3.x release
- [zod versioning](https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/versioning.mdx) — `fetches/openapi-github-zod-versioning.md` — 3.25 ships the `zod/v4` subpath; v3 and v4 types are incompatible
- [zod JSON Schema docs at 3.25.76](https://raw.githubusercontent.com/colinhacks/zod/v3.25.76/packages/docs/content/json-schema.mdx) — `fetches/openapi-github-zod-json-schema-v3-25-76.md` — the installed `toJSONSchema` targets draft-7 and 2020-12 only
- [zod JSON Schema docs, main](https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/json-schema.mdx) — `fetches/openapi-github-zod-json-schema-main.md` — 4.x adds an `openapi-3.0` target
- [zod v4 changelog](https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/changelog.mdx) — `fetches/openapi-github-zod-v4-changelog.md` — breaking changes checked against this repo's usage
- [zod-to-json-schema on npm](https://registry.npmjs.org/zod-to-json-schema) — `fetches/openapi-npm-zod-to-json-schema.md` — deprecated since November 2025
- [hono on npm](https://registry.npmjs.org/hono) — `fetches/openapi-npm-hono.md` — the installed 4.13.5 satisfies every candidate's range
- [Cloudflare static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/index.md) — `fetches/openapi-cloudflare-static-assets-headers.md` — `_headers` adds CORS to static assets
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/index.md) — `fetches/openapi-cloudflare-workers-limits.md` — 10 ms CPU on Free, 64 MiB uncompressed size limit, 1 s startup
