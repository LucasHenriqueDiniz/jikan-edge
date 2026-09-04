---
tags:
  - postmortem
  - kind/plan
  - area/tooling
  - lint
  - formatter
  - checkpoint-gates
  - stale-claims
closed: 2026-09-04
cost: "three slices in one session; one wasted verification pass that reported success"
---

# A linter, a formatter, and an app.ts that was never 558 lines

> Closed 2026-09-04 · jikan-edge@25f8a46 · plans: [[slice-01-add-linter-check-only]], [[slice-02-take-the-reformat]], [[slice-03-split-app-ts]] · pitch: [[pitch-linter-formatter-and-app-ts]] · decision: **D6** in [[ARCHITECTURE]]

## What was planned

Three slices, sequenced so the ugly diff lands alone: configure the tools in check-only mode, take
the reformat as its own commit, then split `src/app.ts` against an already-formatted file. The pitch
argued the sequencing *was* the reason to group them — do the first two in either order without
planning and you get one diff where a 550-line reformat and a real structural change are
indistinguishable.

## What is actually true

| | before | after |
|---|---|---|
| static checks | `tsc --noEmit` only | Biome 2.5.12 (lint + format), wired into CI |
| `pnpm lint` | did not exist | exit 0 |
| files unformatted | 139 of 225 | 0 |
| lint findings | unknown | 0, none suppressed |
| `src/app.ts` | 558 lines | **197** |
| largest file under `src/` | 558 | 426 (`http/routes/anime.routes.ts`) |
| tests | 355 unit / 29 integration | unchanged, all passing |

The sequencing worked exactly as the pitch predicted. Five commits, each reviewable on its own terms:
config, reformat (tool-generated only), hand fixes, CI, split.

## The mistakes, in the order they were made

1. **A verification pass that could only succeed.** Checking that the reformat changed no behaviour
   meant comparing minified output before and after. `esbuild --loader=ts` is only valid reading from
   stdin, so all 137 invocations failed; `2>/dev/null` swallowed the error; every output was empty;
   and comparing empty to empty reported **"136 identical, 0 divergent"**. It read as a clean pass.
2. **Two earlier attempts at the same proof were noisy rather than wrong**, and each cost a cycle:
   whitespace-normalised text (`this.db\n.prepare` collapses to `this.db .prepare`, which differs
   from `this.db.prepare` by one space) and a raw token-stream diff (the TypeScript scanner
   desynchronises on `/` and starts mis-reading template literals as code).
3. **A regex built from a string containing parentheses.** The `app.ts` splitter chose each module's
   dependencies with ``new RegExp(`\\b${name}\\b`)`` where `name` was `watchService(c)` — and `(c)`
   is a capture group. Every module came out with no `deps` parameter.
4. **`sed -i` on a file with 24 non-ASCII characters**, which this repo's own guide forbids. It
   survived, because BSD `sed` under a UTF-8 locale passes the bytes through. Luck, not a
   counter-example.

## What worked

- **Configuring the formatter to what the code already did**, measured rather than chosen: 0 files
  indent with tabs, 767 single-quoted imports against 0 double-quoted, 3,208 semicolons. Only
  `lineWidth` was a real decision, and it was priced across four candidates before 120 was taken —
  at 80 the reformat would have rewritten 173 of 225 files and 27% of all lines to catch one
  747-character handler.
- **`files.includes` as an allowlist rather than a list of exclusions.** By default Biome would have
  reached `tests/fixtures/*.html` (byte-for-byte excerpts of real MyAnimeList pages), `.kanban.json`
  (written by the `kanban` binary) and the CRLF files in `site/`. Any of the three rewritten by the
  reformat is silent corruption that no test would report.
- **Checking encoding and line endings explicitly after a whole-file rewrite.** 94 files carry 364
  non-ASCII characters; all 94 per-file counts matched before and after, no file gained a `\r`, and
  `--ignore-cr-at-eol` matched the plain diffstat. Neither the suite nor `tsc` would have said a word.
- **Scripting the split instead of retyping 93 handlers.** Rerunnable from the pre-split file, which
  is what made "generate, look at the sizes, move the seam, regenerate" cost nothing — and it is how
  `seasons` became its own module after `anime` came out at 511 lines.
- **Comparing the route table, not just the test count.** `app.routes` dumped before and after: 198
  entries identical. A route registered under a wrong path compiles and passes every test that does
  not name it.

## What did not

**The plans' own numbers went stale while they sat on the board.** All three said
`Tests 351 passed (351)`; the suite has been at 355 since the ports pilot added four. Each slice
recorded the gap rather than quietly adjusting the plan, because the check the number was making —
*identical count before and after* — still held at 355.

**Slice 3's `If stuck` branch had expired.** It offered: if no seam works, leave the file at 550,
because the hard limit is 1500 and 550 is a candidate rather than a defect. By the time the slice
ran, slice 2 had taken `app.ts` to **1,782 lines** — past the hard limit, so the fallback was gone.
The file was never 558 lines' worth of code; the handlers were single lines of up to 747 characters
and the reformat is what made the real size visible.

**Three statements in `ARCHITECTURE.md` were falsified by the work as it landed** — "no linter or
formatter", "no lint, format or dead-code gate", and D5's "CI runs typecheck and tests only" — plus
the 558-line gap and a `src/app.ts:538` line reference that no longer exists. Each was fixed in the
same commit as the change that invalidated it, which is the habit this repo's guide was already
asking for and had itself failed at for a month.

## What changed so it cannot recur

| was | is now |
|---|---|
| `tsc --noEmit` as the whole static check surface | `pnpm lint` (format + lint, `--error-on-warnings`) and CI runs it |
| a formatter that could reach fixtures, the board file and the CRLF site | `files.includes` is an allowlist; those three are unreachable by construction |
| a version range on the formatter | pinned exactly — a formatter that drifts version reformats the repo on its own |
| a verification whose failure mode looked like success | check the output is non-empty **before** comparing; make the check fail on purpose once |
| `2>/dev/null` on a step whose errors mattered | the error stream is what said `--loader` was wrong |
| matching source text with a regex built from an identifier | `String.includes`, unless the regex is doing something a substring cannot |
| behaviour claimed from a passing suite | emitted-JS comparison for the reformat, `app.routes` diff for the split |
| ten services carrying a dead `private readonly db` | gone, and ten fewer for DI slice 3 to unwind |
| four `!` asserting past a loose row type | a `UserRow` that states migration 0001's nullability once |

## Still open

- **No dead-code tool.** `noUnusedPrivateClassMembers` found ten dead fields, but it only sees inside
  a class: an exported symbol nothing imports still reads as used. `knip` remains unadopted.
- **`random.routes.ts` builds its own service**, `new RandomService(c.env.DB)`, twice. It is the only
  module that does, because `RandomService` is the one service with no factory in `app.ts`. The split
  made that visible instead of leaving it buried at line 538 of a 1,782-line file; DI slice 3 closes it.
- **`organizeImports` is off**, against Biome's default. Reordering imports changes evaluation order,
  so turning it on is its own decision with its own commit.
