# Search exact-match redirect — Slice 03: manga parity, real fixtures, docs

> **For agentic workers:** implement task-by-task, TDD. Slice 3 of 3. Depends on slices 01-02.

**Goal:** Close the same fix for `/v1/manga?q=`, replace the synthetic detail fragment with a
byte-real fixture, and land the consumer-facing docs (`CHANGELOG.md`, `docs/routes.md`).

**Spec:** [../../pitches/search-exact-match-redirect.md](../../pitches/search-exact-match-redirect.md)

**Architecture / decision:** Same landing-URL routing as slice 02, adding the `mangaDetailToEntry`
mapper and wiring the manga detail branch. Then harden the test with a real captured detail page
(the repo rule: synthetic fixtures hide missing fields). No parser-version bump — re-verified below.

**Tech stack:** TypeScript, Vitest, `wrangler dev --remote` for the probe.

## Global constraints

- Only `https://myanimelist.net`.
- Fixtures are byte-for-byte excerpts of the real page; check field-by-field, not just green tests.
- CHANGELOG entry required in the fix commit (visible bug fix). Leave "Published version: to be
  confirmed" — fill the real id after the push-triggered build.

---

## Task 1: Manga detail-landing parity

**Files:**
- Modify: `src/services/search.service.ts` (add `mangaDetailToEntry`, wire the manga branch)
- Modify imports: `parseMangaDetail` from `../parsers/manga-detail.parser`, `MangaDetail` from
  `../domain/manga`, `MangaSearchEntry` from `../domain/search`
- Test: `tests/services/search-service.test.ts`

**Interfaces:**
- Consumes: `parseMangaDetail(html, malId, fetchedAt?): MangaDetail`; `DETAIL_LANDING` (slice 02).
- Produces: `mangaDetailToEntry(d: MangaDetail, landed: string): MangaSearchEntry` — middle column
  is `volumes`, not `episodes` (the documented anime/manga asymmetry).

- [ ] **Step 1: Write the failing test**

Add a manga case to `tests/services/search-service.test.ts`, mirroring the anime one but with a
manga detail landing (`finalUrl: 'https://myanimelist.net/manga/2/Berserk'`) and asserting the
entry carries `volumes` (not `episodes`):

```ts
it('returns a one-entry manga list with a volumes count on a detail redirect', async () => {
  const source = {
    getHtml: async () => ({
      kind: 'success' as const,
      value: /* small manga detail html with title Berserk, malId 2 */ '',
      metadata: {
        url: 'https://myanimelist.net/manga.php?q=Berserk&cat=manga&o=2&w=1',
        finalUrl: 'https://myanimelist.net/manga/2/Berserk',
        status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: 600,
      },
    }),
  };
  const service = new SearchService(stubDb(), { catalogTtlSeconds: 1 } as never, source as never);
  const result = await service.manga('Berserk', 1, { orderBy: 'start_date', sort: 'desc' } as never, 'req');
  expect(result.data).toHaveLength(1);
  expect(result.data[0]).toHaveProperty('volumes');
  expect(result.data[0]).not.toHaveProperty('episodes');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/services/search-service.test.ts -t "manga list with a volumes count"`
Expected: FAIL — the manga branch currently throws `manga_detail_landing_unimplemented` (slice 02).

- [ ] **Step 3: Add the mapper**

```ts
import { parseMangaDetail } from '../parsers/manga-detail.parser';
import type { MangaDetail } from '../domain/manga';

function mangaDetailToEntry(d: MangaDetail, landed: string): MangaSearchEntry {
  return {
    malId: d.malId,
    url: d.url ?? landed,
    title: d.title,
    imageUrl: d.imageUrl,
    synopsis: d.synopsis,
    type: d.type,
    score: d.score,
    volumes: d.volumes,
  };
}
```

- [ ] **Step 4: Wire the manga branch**

Replace the slice-02 placeholder in the detail branch:

```ts
value = type === 'anime'
  ? [animeDetailToEntry(parseAnimeDetail(source.value, malId), landed)]
  : [mangaDetailToEntry(parseMangaDetail(source.value, malId), landed)];
```

- [ ] **Step 5: Run it, verify it passes**

Run: `npx vitest run tests/services/search-service.test.ts -t "manga list with a volumes count"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/search.service.ts tests/services/search-service.test.ts
git commit -m "fix(search): same detail-redirect fix for exact-title manga search"
```

## Task 2: Probe manga on the real edge, then swap in byte-real fixtures

**Files:**
- Create: `tests/fixtures/anime/detail-search-redirect.html` (byte-real excerpt of a real detail)
- Create: `tests/fixtures/manga/detail-search-redirect.html`
- Modify: `tests/services/search-service.test.ts` (load the fixtures instead of inline strings)

- [ ] **Step 1: Probe manga behavior on Cloudflare's edge**

Run the remote Worker and confirm a manga exact-title + `order_by` reproduces the redirect
(answers the open Research-Needed item in the pitch):

```bash
npx wrangler dev --remote --port 8788
# then, in another shell:
curl -s "http://localhost:8788/v1/manga?q=Berserk&order_by=start_date&sort=desc" | head -c 200
```

If it 502s pre-fix (or, on this branch, returns one entry post-fix), the manga path matches anime.
Capture the actual detail page you redirect to (note its `malId`/slug from the response `url`).
If manga does **not** redirect on the edge, record that in the pitch and drop the manga fixture to a
regression-only unit — do not invent a redirect that does not happen.

- [ ] **Step 2: Capture byte-real detail excerpts**

Save real excerpts (per the repo fixture rule — include `og:url`, `og:image`, title, score, and the
episodes/volumes cell; verify field-by-field that `parseAnimeDetail`/`parseMangaDetail` extract a
non-null `malId`, `title`, and the count). Keep them small but real.

- [ ] **Step 3: Point the slice-02 and slice-03 tests at the fixtures**

Replace the inline `detailHtml` strings with `readFileSync` of the fixtures (match how other tests
in the repo load fixtures).

- [ ] **Step 4: Run the full parser + service suites**

Run: `npx vitest run tests/services/ tests/parsers/`
Expected: PASS with real fixtures.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/anime/detail-search-redirect.html tests/fixtures/manga/detail-search-redirect.html tests/services/search-service.test.ts
git commit -m "test(search): byte-real detail fixtures for the exact-match redirect path"
```

## Task 3: Docs, changelog, and parser-version re-check

**Files:**
- Modify: `docs/routes.md` (the anime/manga search section — note the exact-match redirect behavior)
- Modify: `CHANGELOG.md`
- Modify: `.claude/CLAUDE.md` (add a one-line note to the search bullets, per project rule)

- [ ] **Step 1: Re-confirm no parser-version bump is needed**

The fix turns a 502 into data for exact-match queries. 502s are never cached (only successful
values persist), and the shape of normal multi-row results is unchanged. Therefore no
`ANIME_SEARCH_PARSER_VERSION`/`MANGA_SEARCH_PARSER_VERSION` bump — no poisoned rows exist to
invalidate. If, during implementation, any *normal* result's emitted fields changed, bump both and
say so here. (Record the decision either way.)

- [ ] **Step 2: Write the docs**

- `docs/routes.md`: under anime/manga search, document that an exact-title query (optionally with
  `order_by`) that MAL redirects to the detail page now returns that single title as a one-entry
  list, and that routing is by landing URL, not a title marker.
- `CHANGELOG.md`: new dated entry — before/after (was `502 UPSTREAM_SUSPICIOUS` on exact-title +
  `order_by`, now the matched entry), root cause one line, "Published version: to be confirmed".
- `.claude/CLAUDE.md`: one line in the search notes pointing at this behavior and this plan.

- [ ] **Step 3: Full green + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/routes.md CHANGELOG.md .claude/CLAUDE.md
git commit -m "docs(search): record the exact-match redirect fix (routes, changelog, agent guide)"
```

## Verification (slice gate / feature done)

```bash
npm test && npx tsc --noEmit
```
Then the live acceptance from the pitch's Success Criteria, on `wrangler dev --remote`:

```bash
curl -s "http://localhost:8788/v1/anime?q=Lv999+no+Murabito&order_by=start_date&sort=desc" | head -c 120
# expect: {"data":[{"malId":62322, ...
curl -s "http://localhost:8788/v1/anime?q=Lv999&order_by=start_date&sort=desc" | head -c 60
# expect: still a normal results list (no regression)
```

Closes [issue #16](https://github.com/LucasHenriqueDiniz/jikan-edge/issues/16).
