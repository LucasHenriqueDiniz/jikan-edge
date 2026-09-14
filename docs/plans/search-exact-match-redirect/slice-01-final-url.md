# Search exact-match redirect — Slice 01: capture the post-redirect URL

> **For agentic workers:** implement this slice task-by-task, TDD, tests alongside the code.
> Steps use `- [ ]` checkboxes. This is slice 1 of 3 — see the sibling files in this directory.

**Goal:** `MalClient` records the URL it actually landed on after following redirects, so a later
slice can tell "search results page" from "redirected to a detail page" without re-fetching.

**Spec:** [../../pitches/search-exact-match-redirect.md](../../pitches/search-exact-match-redirect.md)

**Architecture / decision:** The fix hinges on distinguishing *where the fetch landed*. MAL
303-redirects an exact-title search (`anime.php?q=<exact title>`) to the entity detail page
(`/anime/:id/...`); today `MalClient` follows that redirect and the search service's title-string
marker guard rejects the detail page as `suspicious` → 502 (root cause confirmed live, see the
pitch). We add the landing URL to `SourceMetadata` as the seam. This slice is pure plumbing — no
behavior change yet; every existing test must stay green.

**Tech stack:** TypeScript, Cloudflare Workers, Vitest. Test: `tests/source/mal-client.test.ts`.

## Global constraints

- Only `https://myanimelist.net` (unchanged — this slice touches no URLs).
- No batch shell rewrites of files with non-ASCII content; use the editing tool.
- After editing, check `git diff --stat` matches the change size (LF-only in `src/`/`tests/`).

---

## Task 1: Add `finalUrl` to `SourceMetadata` and populate it in `MalClient`

**Files:**
- Modify: `src/source/source-types.ts` (the `SourceMetadata` interface)
- Modify: `src/source/mal-client.ts:66-73` (the metadata object built after redirect-following)
- Test: `tests/source/mal-client.test.ts`

**Interfaces:**
- Produces: `SourceMetadata.finalUrl?: string` — the URL actually fetched after all redirects
  were followed. Optional: the pre-body error returns (redirect-without-location, host-not-allowed,
  too-many-redirects) leave it `undefined`; only the path that reads a body sets it. Consumed by
  slice 02 as `source.metadata.finalUrl ?? source.metadata.url`.

- [ ] **Step 1: Write the failing test**

Add to `tests/source/mal-client.test.ts`, inside `describe('MalClient redirects', ...)`:

```ts
it('records the post-redirect landing URL in metadata.finalUrl', async () => {
  let calls = 0;
  const client = new MalClient(config, async () => {
    calls += 1;
    return calls === 1
      ? new Response('', { status: 303, headers: { location: '/anime/62322/Lv999_no_Murabito' } })
      : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  });
  const result = await client.getHtml('https://myanimelist.net/anime.php?q=x', ['Anime Stats']);
  expect(result.kind).toBe('success');
  expect(result.metadata.finalUrl).toBe('https://myanimelist.net/anime/62322/Lv999_no_Murabito');
});

it('sets finalUrl to the requested URL when there is no redirect', async () => {
  const client = new MalClient(config, async () =>
    new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }));
  const result = await client.getHtml('https://myanimelist.net/anime.php?q=x', ['Anime Stats']);
  expect(result.metadata.finalUrl).toBe('https://myanimelist.net/anime.php?q=x');
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/source/mal-client.test.ts -t finalUrl`
Expected: FAIL — `finalUrl` is `undefined` (property does not exist yet).

- [ ] **Step 3: Add the optional field to the interface**

In `src/source/source-types.ts`, add to `SourceMetadata`:

```ts
export interface SourceMetadata {
  url: string;
  finalUrl?: string;
  status: number | null;
  contentType: string | null;
  durationMs: number;
  sizeBytes: number;
}
```

- [ ] **Step 4: Populate it in `MalClient`**

In `src/source/mal-client.ts`, the metadata object built after the redirect loop
(currently around line 67) sets `url`. Add `finalUrl`:

```ts
const metadata = {
  url,
  finalUrl: target.toString(),
  status: response.status,
  contentType: response.headers.get('content-type'),
  durationMs: Math.round(performance.now() - startedAt),
  sizeBytes: contentLength,
};
```

`target` is the `URL` the loop last fetched (equal to the original `parsed` when no redirect
occurred, or the redirect destination otherwise). No other return site changes.

- [ ] **Step 5: Run the new tests, verify they pass**

Run: `npx vitest run tests/source/mal-client.test.ts -t finalUrl`
Expected: PASS (both).

- [ ] **Step 6: Run the whole source suite, verify no regression**

Run: `npx vitest run tests/source/`
Expected: PASS — the optional field breaks no existing metadata assertion.

- [ ] **Step 7: Commit**

```bash
git add src/source/source-types.ts src/source/mal-client.ts tests/source/mal-client.test.ts
git commit -m "feat(source): record post-redirect landing URL in SourceMetadata.finalUrl"
```

## Verification (slice gate)

```bash
npx vitest run tests/source/ && npx tsc --noEmit
```
Both must pass. No route behavior has changed yet — slice 02 consumes `finalUrl`.
