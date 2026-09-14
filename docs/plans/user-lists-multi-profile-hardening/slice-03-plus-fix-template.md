# User-list hardening — Slice 03+: the fix-slice template

> **For agentic workers:** this is a **template**, not a single slice. Instantiate one copy per
> divergence that slice 02's `findings.md` lists as a real bug, numbered `slice-03`, `slice-04`, …

## Discovery boundary — why the fixes are not enumerated here

This is discovery-driven work. The pitch's whole thesis is *"a reference profile is not a sample"* —
so which fields, layouts, or title shapes actually break is **unknown until slice 02 runs**. Writing
concrete fix slices now would be inventing bugs against profiles no one has looked at, which is the
exact mistake the loop's research→plan split exists to prevent. Slice 02 produces the real,
evidence-backed list of fixes; each becomes one instantiation of the template below.

Do **not** start production code on a divergence until it has a captured fixture and a failing test
(TDD). Do **not** bump `LIST_PARSER_VERSION` unless the fix changes an emitted value or shape.

## Where fixes land (from the pitch's Architecture)

- `src/parsers/user-list.parser.ts` — `parseUserMediaListSnapshot` (returns `ListParseResult`:
  `complete | empty | partial | invalid`), `listLayout`, `modernEntries`, the classic anchor regex,
  `LIST_PAGE_SIZE = 300`. Most fixes land here.
- `src/services/user.service.ts` — `mediaList()`: `?status=7` fetch, `&offset=` pagination (modern
  only), `MAX_LIST_PAGES = 20` → `LIST_TOO_LARGE`, and the completeness cross-check vs the profile's
  `totalEntries` in D1.
- `LIST_PARSER_VERSION` lives in `src/domain/list-entry.ts` (separate from the profile's
  `PARSER_VERSION` by design — lists invalidate without refetching whole profiles).
- Fixtures: `tests/fixtures/users/` (byte excerpts of real pages, **never** synthetic stubs).
- Parser tests: `tests/parsers/user-list.test.ts`. Guard/service tests:
  `tests/integration/user-list-guards.test.ts`, `tests/services/list-refresh-lease.test.ts`.

---

## Template: Slice NN — <divergence short name>

**Goal:** <one sentence: which real profile/shape breaks, and what "fixed" means for it>.

**Evidence:** `docs/research/user-list-corpus/findings.md` entry for <profile>, raw HTML at
`docs/research/user-list-corpus/fetches/<profile>-<media>.html`.

**Files:**
- Modify: `src/parsers/user-list.parser.ts` and/or `src/services/user.service.ts`
- Create: `tests/fixtures/users/<shape>.html` (sanitized byte excerpt of the captured page)
- Test: `tests/parsers/user-list.test.ts` (and/or the guard/integration tests above)

- [ ] **Step 1: Capture the sanitized fixture** — a byte excerpt of the real page that reproduces the
  shape (strip PII/cookies; keep the markup that matters). Confirm field-by-field it contains the
  fields the test will assert, not just that it is non-empty.
- [ ] **Step 2: Write the failing test** — assert the **exact** field values the real page should
  yield (count, and the specific field that was wrong), so it fails on the current parser.
- [ ] **Step 3: Run it, confirm it fails** for the right reason (`npx vitest run tests/parsers/user-list.test.ts -t "<name>"`).
- [ ] **Step 4: Fix the parser/service** minimally to satisfy the real shape, without regressing the
  other layout (run the whole `user-list` suite, not just the new case).
- [ ] **Step 5: Decide the version bump** — bump `LIST_PARSER_VERSION` **iff** an emitted value or
  shape changed for already-cached lists; if the fix only turns an error into data (never cached),
  no bump. Record the decision in the commit message.
- [ ] **Step 6: Re-probe that profile on the remote Worker** (`node spikes/list-probe/probe.mjs
  <profile>`) and confirm count now matches `totalEntries`.
- [ ] **Step 7: Docs + commit** — `CHANGELOG.md` entry for any consumer-visible change; update
  `docs/sources/mal-list-delivery.md` (grow the "reference profile is not a sample" table). Commit
  the fixture, test, fix, and docs together.

**Slice gate:** `npm test && npx tsc --noEmit`, plus the re-probe of that profile passing.

---

## Feature done when

Every real divergence from slice 02 has its own instantiated slice, all green, each with a fixture +
regression test that fails on the old code; `docs/sources/mal-list-delivery.md` reflects the widened
corpus; and a final probe run of the whole corpus (via the slice-01 harness) shows every profile at
`200` with a matching count, or a correct, recorded 501/502. Then a `docs/postmortem/` note if any
measurement turned out wrong (the loop's step 6).
