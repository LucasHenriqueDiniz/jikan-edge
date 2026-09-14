---
tags:
  - pitch
  - users
  - lists
  - parser
  - robustness
status: active
kanban:
---

# Pitch — Harden user anime/manga lists against real-profile variety

## Problem

`GET /v1/users/:u/animelist` and `/mangalist` are implemented and live. But everything
we *know* about how well they hold up comes from a **single sweep on 2026-07-30**, against
**five profiles** (AMayacrab, Zel, Xinil, jet2r0cks, Karinyia — see
[[mal-list-delivery]]). The route's whole history is a lesson in why that is not enough:

- The original implementation was validated against **one** reference profile (AMayacrab,
  classic layout) and generalized "single-page snapshot" from it. That was wrong on three
  counts, and the **modern layout returned a 502 for every user who used it** until the
  sweep happened to hit one.
- The most dangerous failure this project has recorded was here and was **silent**: 273 of
  360 entries served as a `200`, no error at all.
- A single anime titled `86` (a JSON number, not a string) took down a whole 2,354-entry
  list, because one invalid item rejects the entire snapshot.

The source's own note draws the conclusion: *"a reference profile is not a sample."* MAL
picks the list layout from a **user-controlled setting**, and there are more shape/style
variants in the wild than the two we've named (custom CSS lists, tag columns, shared/
restricted lists, empty lists, airing entries with `-` totals, non-Latin titles, huge
lists near the 6,000 ceiling). We have no ongoing corpus and no evidence the parser is
correct beyond the five profiles it was born against.

The author's ask, in their words: *"as listas do MyAnimeList, dá pra pegar? vamos arrumar
elas, precisa testar com vários perfis pq tem estilos e afins."* — i.e. confirm the lists
still work, then **harden them against the variety of real profiles/layouts**, driven by a
broad multi-profile test, not by one reference user.

## Solution

Build a **multi-profile probe + fixture corpus** for user lists, run it against the *real*
network the way the source actually reaches MAL, and fix every divergence it surfaces —
each with a captured fixture and a regression test so it can never silently return.

Concretely:

1. **Regression check first.** Confirm the five known profiles still parse and still match
   their profile `totalEntries`. If any 502/501/wrong-count regressed, that's a bug fix
   before any new work (this is the "dá pra pegar?" part).
2. **Assemble a diverse profile list** deliberately spanning the axes that change parsing:
   layout (classic/modern), size (empty → near-6,000), title shape (numeric, non-Latin,
   quotes/entities), entry state (airing with `-` total, plan-to-watch, completed), and
   list privacy/style variants.
3. **Probe each on the real edge network** (`wrangler dev --remote`, config
   `jikan-edge-remote`) — because how MAL responds to Cloudflare is the thing under test;
   `--local` reproduces none of it.
4. For every profile, **cross-check the assembled list against `totalEntries`** and diff
   field-by-field, not just count. Capture the divergent ones as sanitized fixtures.
5. **Fix parser/service** for each real divergence; bump `LIST_PARSER_VERSION` only when an
   emitted value or shape actually changes.

## Architecture

The shape is unchanged — this hardens existing components, it does not add a route:

- `src/parsers/user-list.parser.ts` — the two-layout parser (`classic`/`modern`,
  `parseUserMediaListSnapshot`). Most fixes land here.
- `src/services/user.service.ts` — `mediaList()`: `?status=7` fetch, `&offset=` pagination
  (modern only, 20-page ceiling → 501 `LIST_TOO_LARGE`), and the completeness cross-check
  against the profile's `totalEntries` in D1 (fewer → 502, more → accept, no profile →
  serve unchecked).
- A **new probe harness** (likely under `spikes/` or `scripts/`, following
  `spikes/profile-probe/`) that drives many usernames through the deployed/remote worker and
  reports count + field diffs. This is throwaway measurement scaffolding, not production.
- Fixtures under `tests/fixtures/users/` (currently `anime-list{,-modern}.html`,
  `manga-list{,-modern}.html`) grow to cover the new shapes.

Data flow is unchanged: MAL HTML → parser snapshot (`complete|empty|partial|invalid`) →
service completeness gate vs. D1 profile → repository → cached response.

## Schema / Data Changes

- **No table/migration changes expected** for the harness/corpus work itself.
- `LIST_PARSER_VERSION` bump **only if** a fix changes an emitted value or shape (it is
  deliberately separate from the profile's `PARSER_VERSION`, so lists invalidate without
  refetching whole profiles). A bump is a one-way cache invalidation, not a data migration.
- Do **not** reintroduce `declaredTotal` in the parser — there is no source for it on the
  page; the real check lives in the service. *(recorded decision, keep it that way)*

## Interfaces / APIs

No new or changed public interface is planned. For reference, the routes under test:

| Method | Route / Entry point | Auth | Description |
|--------|---------------------|------|-------------|
| GET | `/v1/users/:username/animelist?page=` | none | User's full anime list (`?status=7` upstream, paginated) |
| GET | `/v1/users/:username/mangalist?page=` | none | User's full manga list |

*If the probe reveals the completeness contract itself is wrong (e.g. a legitimate case
that should 200 currently 502s), a contract change enters scope and this table + CHANGELOG
get an entry.*

## Scope

### In Scope
- [ ] Regression-verify the 5 known profiles (count + field match vs. `totalEntries`).
- [ ] Build a repeatable multi-profile probe harness against the remote worker.
- [ ] Curate a profile list spanning layout / size / title-shape / entry-state / privacy.
- [ ] Capture sanitized fixtures for each genuinely new shape found.
- [ ] Fix every real divergence in parser/service; add a regression test per fix.
- [ ] Bump `LIST_PARSER_VERSION` where an emitted value/shape changes; CHANGELOG entry for
      any consumer-visible change.

### Out of Scope
- Any list route other than `animelist`/`mangalist` (club/producer/genre lists are separate).
- `users/:u/history` (empty without login — already a recorded non-goal) and reaching
  `load.json` or any internal MAL endpoint (forbidden by the source policy).
- Fetching beyond the 20-page / 6,000-entry ceiling; profiles past it stay a 501, by design.
- The classic-layout field asymmetry (`status`/`startedAt`/`finishedAt`/`updatedAt` stay
  `null`) — a deliberate source limitation, **unless** the probe finds the classic page
  actually exposes them and we simply weren't reading them.
- A general performance/benchmark pass on lists (separate concern).

## Research Needed
- [ ] Which real profiles exhibit **layout/style variants beyond the two named** (custom-CSS
      lists, tag columns, alternate table shapes)? Do any break the anchor regex or `data-items`?
- [ ] Behavior of a **genuinely empty list** and a **fully private/restricted list** under
      `?status=7` — does the current `empty`/`partial`/502 handling match reality?
- [ ] Are there title shapes beyond numeric that still corrupt (e.g. titles containing
      `data-items="` -like substrings, deeply nested entities, RTL/CJK)?
- [ ] Does the **profile `totalEntries` cross-check** ever produce a false 502 for a
      legitimate list (e.g. the profile counts differently from the list page)?
- [ ] Do any real lists approach or cross the 6,000 ceiling, and is 501 the right answer for
      them, or should the ceiling move?
- [ ] Confirm the remote-network probe path (`jikan-edge-remote`) still reflects how MAL
      truncates/serves to Cloudflare (the genre-taxonomy lesson).

## Testing Strategy

- **Parser unit tests** (`tests/parsers/user-list.test.ts`) — one fixture per newly
  discovered shape, asserting exact field values, not just non-empty. Follow the existing
  rule: fixtures are **byte excerpts of real pages**, never synthetic stubs (synthetic
  fixtures are how the classic parser passed while broken).
- **Service/guard tests** (`tests/integration/user-list-guards.test.ts`,
  `tests/services/list-refresh-lease.test.ts`) — completeness gate, `LIST_TOO_LARGE`,
  cross-check-vs-`totalEntries`, and the long-refresh lease.
- **Real-network probe** — the harness itself is the acceptance evidence: every curated
  profile parses and its assembled count matches its profile `totalEntries`. Record the run
  (like `docs/results/2026-07-26-catalog-corpus-benchmark.md`) so the corpus is reproducible.

## Success Criteria
- [ ] Every profile in the curated corpus returns `200` with a count matching its
      `totalEntries` (or a *correct, deliberate* 501/502 with a recorded reason).
- [ ] Each divergence found is backed by a real fixture + a test that fails on the old code.
- [ ] `docs/sources/mal-list-delivery.md` updated with the widened corpus and any new
      layout/style findings; the "reference profile is not a sample" table grows.
- [ ] No silent truncation: a partial/invalid snapshot never replaces valid D1 data.
- [ ] CHANGELOG entry for any consumer-visible change, `LIST_PARSER_VERSION` bumped iff a
      value/shape changed.
