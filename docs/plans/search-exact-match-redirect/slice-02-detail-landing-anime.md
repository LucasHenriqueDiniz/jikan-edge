# Search exact-match redirect — Slice 02: route on the landing URL (anime)

> **For agentic workers:** implement task-by-task, TDD. Slice 2 of 3. Depends on slice 01
> (`SourceMetadata.finalUrl`).

**Goal:** An exact-title anime search that MAL redirects to the detail page returns a **one-entry
result list** for that title, instead of `502 UPSTREAM_SUSPICIOUS`.

**Spec:** [../../pitches/search-exact-match-redirect.md](../../pitches/search-exact-match-redirect.md)

**Architecture / decision:** Replace the fragile title-string marker guard
(`'Search Anime - MyAnimeList.net'`) with **landing-URL routing** on `metadata.finalUrl`:

- landed on `/{type}/{id}` detail page  → parse the body already in hand with the existing
  `parseAnimeDetail(html, id)` and map its `AnimeDetail` to one `AnimeSearchEntry`;
- landed on `{type}.php` (the search page) → parse results as today;
- landed anywhere else (e.g. `/anime/genre/1/Action`) → throw `suspicious` ourselves.

This reuses the detail HTML the redirect already fetched — **no second request** — and the
landing-URL check is strictly more precise than the old title-string marker (which is why the
genre-only redirect protection it replaces still holds). The mapping is field-complete because
`AnimeDetail` carries every `SearchEntry` field; the one gap is `AnimeDetail.url` being
`string | null`, so it falls back to the landing URL.

**Tech stack:** TypeScript, Vitest. Test: `tests/services/search-service.test.ts`.

## Global constraints

- Only `https://myanimelist.net`.
- No parser-version bump in this slice: 502s were never cached (errors aren't persisted), and the
  shape of normal results is unchanged — so no poisoned rows exist to invalidate. (Re-confirm in
  slice 03 before shipping.)
- LF line endings in `src`/`tests`; check `git diff --stat`.

---

## Task 1: Map a redirected detail landing to a single anime search entry

**Files:**
- Modify: `src/services/search.service.ts` (the `search()` refresh closure, ~lines 149-162; add a
  `DETAIL_LANDING` regex and an `animeDetailToEntry` mapper near the top of the module)
- Modify imports in `src/services/search.service.ts`: add `parseAnimeDetail` from
  `../parsers/anime-detail.parser` and `AnimeDetail` type from `../domain/anime`
- Test: `tests/services/search-service.test.ts`

**Interfaces:**
- Consumes: `SourceResult.metadata.finalUrl?` (slice 01); `parseAnimeDetail(html, malId, fetchedAt?)
  : AnimeDetail`; `AnimeSearchEntry` from `../domain/search`.
- Produces: internal `animeDetailToEntry(d: AnimeDetail): AnimeSearchEntry`; a
  `DETAIL_LANDING = /^https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\b/` module constant reused
  by slice 03.

- [ ] **Step 1: Write the failing test**

Add to `tests/services/search-service.test.ts`:

```ts
import { parseAnimeSearchResults } from '../../src/parsers/search.parser'; // (may already be indirect)

describe('anime search that MAL redirects to a detail page', () => {
  // Minimal real-shape fragments the anime detail parser needs: title, image, score, type,
  // episodes. Keep this small; slice 03 swaps in a byte-real fixture.
  const detailHtml =
    '<html><head><title>Lv999 no Murabito - MyAnimeList.net</title>'
    + '<meta property="og:url" content="https://myanimelist.net/anime/62322/Lv999_no_Murabito">'
    + '<meta property="og:image" content="https://cdn.myanimelist.net/images/anime/1366/158400.jpg"></head>'
    + '<body>'.padEnd(600, ' ')
    + '<span class="h1-title"><strong>Lv999 no Murabito</strong></span>'
    + '<span itemprop="ratingValue">7.5</span>'
    + '</body></html>';

  it('returns a one-entry list for the matched title instead of 502', async () => {
    const source = {
      getHtml: async (_url: string) => ({
        kind: 'success' as const,
        value: detailHtml,
        metadata: {
          url: 'https://myanimelist.net/anime.php?q=Lv999%20no%20Murabito&cat=anime&o=2&w=1',
          finalUrl: 'https://myanimelist.net/anime/62322/Lv999_no_Murabito',
          status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600,
        },
      }),
    };
    const service = new SearchService(stubDb(), { catalogTtlSeconds: 1 } as never, source as never);

    const result = await service.anime('Lv999 no Murabito', 1, { orderBy: 'start_date', sort: 'desc' } as never, 'req');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ malId: 62322, title: 'Lv999 no Murabito' });
  });
});
```

> Note: match the exact `service.anime(...)` signature and the `ServiceResponse` accessor used by
> the other tests in this file — read the surrounding cases before finalizing the assertion shape
> (`result.data` vs `result.value`). Adjust `detailHtml` so `parseAnimeDetail` returns a valid
> `malId`/`title`; run the parser's own tests (`tests/parsers/`) to see the fields it reads.

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/services/search-service.test.ts -t "redirects to a detail page"`
Expected: FAIL — today the marker guard path yields 502 (or the fake bypasses it and rows parse
empty). Confirm the failure is "expected 1, got 0/threw", not a harness typo.

- [ ] **Step 3: Add the mapper and the routing constant**

Near the top of `src/services/search.service.ts` (after imports):

```ts
import { parseAnimeDetail } from '../parsers/anime-detail.parser';
import type { AnimeDetail } from '../domain/anime';

const DETAIL_LANDING = /^https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\b/;

function animeDetailToEntry(d: AnimeDetail, landed: string): AnimeSearchEntry {
  return {
    malId: d.malId,
    url: d.url ?? landed,          // AnimeDetail.url is string | null; SearchEntry.url is required
    title: d.title,
    imageUrl: d.imageUrl,
    synopsis: d.synopsis,
    type: d.type,
    score: d.score,
    episodes: d.episodes,
  };
}
```

Ensure `AnimeSearchEntry` is imported (it is used in the file's `SearchEntry` union already; add
the named import if missing).

- [ ] **Step 4: Route on the landing URL in the refresh closure**

Replace the marker-based fetch/parse block in `search()` (currently lines ~150-158) with:

```ts
// Landing-URL routing replaces the old title-string marker: MAL 303-redirects an exact-title
// search to the entity's detail page, and MalClient follows it. The old marker
// ('Search Anime - MyAnimeList.net') is absent on the detail page, so that case became a 502.
// finalUrl tells us where we actually landed — more precise than any title string.
const source = await this.source.getHtml(searchUrl(type, query, page, extra), []);
if (source.kind !== 'success') throw sourceError(source);
const landed = source.metadata.finalUrl ?? source.metadata.url;
const detail = landed.match(DETAIL_LANDING);
let value: SearchEntry[];
if (detail && detail[1] === type) {
  const malId = Number(detail[2]);
  value = type === 'anime'
    ? [animeDetailToEntry(parseAnimeDetail(source.value, malId), landed)]
    : [/* manga: added in slice 03 */] as SearchEntry[];
} else if (landed.includes(`/${type}.php`)) {
  value = type === 'anime' ? parseAnimeSearchResults(source.value) : parseMangaSearchResults(source.value);
} else {
  // e.g. redirected to /anime/genre/1/Action — a wrong page, as the old marker guard caught.
  throw sourceError({ kind: 'suspicious', reason: 'unexpected_search_landing', metadata: source.metadata });
}
const fetchedAt = new Date().toISOString();
await this.catalog.put(cacheKey, value, fetchedAt, version);
return value;
```

The `marker` local and its comment are removed. Leave the manga detail branch as a TODO placeholder
that slice 03 fills — but since `type === 'manga'` with a detail landing would then return `[]`,
gate this slice's behavior change to anime only by keeping the manga branch throwing:

```ts
value = type === 'anime'
  ? [animeDetailToEntry(parseAnimeDetail(source.value, malId), landed)]
  : (() => { throw sourceError({ kind: 'suspicious', reason: 'manga_detail_landing_unimplemented', metadata: source.metadata }); })();
```

- [ ] **Step 5: Run the new test, verify it passes**

Run: `npx vitest run tests/services/search-service.test.ts -t "redirects to a detail page"`
Expected: PASS.

- [ ] **Step 6: Run the full search + genre-only suites, verify no regression**

Run: `npx vitest run tests/services/search-service.test.ts tests/services/search-genre-only.test.ts tests/services/search-filters.test.ts`
Expected: PASS — a normal results page (`finalUrl` = `anime.php...`) still routes to
`parseAnimeSearchResults`; a genre-browse redirect still becomes `suspicious`.

- [ ] **Step 7: Commit**

```bash
git add src/services/search.service.ts tests/services/search-service.test.ts
git commit -m "fix(search): return the matched title when MAL redirects an exact anime search to the detail page"
```

## Verification (slice gate)

```bash
npx vitest run tests/services/ tests/parsers/ && npx tsc --noEmit
```
All pass. Manga still 502s on a detail landing — closed in slice 03.
