# User-list hardening — Slice 01: regression baseline on the known profiles

> **For agentic workers:** implement task-by-task. Slice 1 of a discovery-driven plan — see the
> sibling files and the "Discovery boundary" note in slice 03.

**Goal:** Prove the `animelist`/`mangalist` routes still parse the **five known profiles** and still
match each profile's `totalEntries`, on the real edge network — the "dá pra pegar?" check — and
leave a repeatable probe harness behind. Any regression found here becomes a fix slice immediately.

**Spec:** [../../pitches/user-lists-multi-profile-hardening.md](../../pitches/user-lists-multi-profile-hardening.md)

**Architecture / decision:** This slice adds **no production code**. It builds throwaway measurement
scaffolding (following `spikes/profile-probe/`) that drives usernames through the Worker running on
Cloudflare's real network (`wrangler dev --remote`, config `jikan-edge-remote`, port 8788 — because
how MAL serves Cloudflare is the thing under test; `--local` reproduces none of it), and cross-checks
the assembled list count against the profile's `totalEntries`. Output is a findings doc, not a
feature.

**Tech stack:** TypeScript, Vitest, `wrangler dev --remote`, `curl`/Node probe script.

## Global constraints

- Only `https://myanimelist.net`; no `load.json` or any internal endpoint.
- Real-network probe only via `jikan-edge-remote` (port 8788).
- No batch shell rewrites of files with non-ASCII (titles are CJK/RTL); use the editing tool or
  Node `utf8`. Verify `git diff --stat` matches the change size before committing.

---

## Task 1: Build the multi-profile probe script

**Files:**
- Create: `spikes/list-probe/probe.mjs` (Node script; standalone, not bundled into the Worker)
- Reference: `spikes/profile-probe/` (the existing minimal-Worker precedent), `scripts/render-og.mjs`
  (an existing standalone `.mjs` for style)

**Interfaces:**
- Consumes: a running remote Worker at `http://localhost:8788`.
- Produces: for each `{username}`, a row `{ username, mediaType, httpStatus, listCount,
  profileTotalEntries, match: boolean, note }` printed as JSON lines and a summary table.

- [ ] **Step 1: Write the probe script**

The script reads a username list from `argv`/a constant, and for each user + each media type calls
the Worker, paging until the response's `data.total` is covered or a non-200 arrives. It also fetches
`/v1/users/:u/statistics` (or `/v1/users/:u` full) to read the profile's `totalEntries` for the
cross-check. Pseudocode to implement concretely:

```js
// spikes/list-probe/probe.mjs
const BASE = process.env.PROBE_BASE ?? 'http://localhost:8788';
const USERS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['AMayacrab', 'Zel', 'Xinil', 'jet2r0cks', 'Karinyia'];

async function listCount(user, media) {
  let page = 1, total = null, seen = 0, status = 0;
  for (;;) {
    const res = await fetch(`${BASE}/v1/users/${user}/${media}list?page=${page}`);
    status = res.status;
    if (status !== 200) return { status, seen: null };
    const body = await res.json();
    total = body.data.total ?? total;
    seen += body.data.entries.length;
    if (body.data.entries.length === 0 || (total != null && seen >= total)) break;
    page += 1;
    if (page > 25) break; // safety; the route caps at 20 pages itself
  }
  return { status, seen };
}
// profileTotal(user, media): read /v1/users/:u/statistics -> data.anime.totalEntries / data.manga...
// print one JSON line per (user, media) with match = seen === profileTotal
```

- [ ] **Step 2: Start the remote Worker and run the probe**

```bash
npx wrangler dev --remote --port 8788   # background; wait for /health 200
node spikes/list-probe/probe.mjs
```

Expected: five users × two media = ten rows. Record the raw output.

- [ ] **Step 3: Commit the harness**

```bash
git add spikes/list-probe/probe.mjs
git commit -m "test(lists): add a multi-profile list probe harness against the remote worker"
```

## Task 2: Record the baseline and gate on it

**Files:**
- Create: `docs/results/2026-09-14-user-list-regression-baseline.md`

- [ ] **Step 1: Write the findings doc**

Record, per profile: layout (classic/modern), list count, profile `totalEntries`, match/mismatch,
and HTTP status. Follow the shape of `docs/results/2026-07-26-catalog-corpus-benchmark.md`. State
explicitly whether the 2026-07-30 numbers still hold (Xinil 399, AMayacrab 360).

- [ ] **Step 2: Classify the result**

- **All match** → baseline green; proceed to slice 02 (widen the corpus).
- **Any mismatch / 502 / 501 / wrong count** → a **regression**. Stop and open a fix slice using the
  slice-03 template *before* any corpus-widening work; the regression is more urgent than new
  coverage.

- [ ] **Step 3: Commit**

```bash
git add docs/results/2026-09-14-user-list-regression-baseline.md
git commit -m "docs(lists): record the user-list regression baseline for the five known profiles"
```

## Verification (slice gate)

The probe runs clean against the remote Worker and every one of the five known profiles either
matches its `totalEntries` **or** has a recorded, opened fix slice. The harness is reusable by
slice 02 with a different username list.
