---
status: done
kanban: 9f2263c7-5760-4121-bc63-0dc1c92d50f5
---

# Slice 1 — Add the linter and formatter in check-only mode

## Delivers

`pnpm lint` exists and runs. Nothing under `src/` is reformatted in this commit — the whole point is
that the config lands alone, so the reformat that follows is reviewable as its own diff.

`package.json` gains `lint` (and `lint:fix`). The commit contains the config file, the scripts, and
nothing else.

## Needs

- A tool choice. `eslint`, `biome` and `prettier` are all named in the audit. Biome is one binary
  doing both jobs and needs no plugin chain for TypeScript; that is the default unless there is a
  reason against it. Write the reason down either way — this is a choice the next reader will
  second-guess.
- Nothing exists to build on: `ls -a | grep -iE 'eslint|prettier|biome|oxlint|editorconfig'` returns
  nothing today.
- `.github/` already runs the suite in CI. Do not wire `lint` into CI in this slice — a red CI on a
  known-unformatted repo teaches everyone to ignore it.

## Tests

- The tool's own check run is the test. There is no code to unit-test.
- Done means `pnpm lint` executes and reports, not that it passes. A configuration tuned until it
  reports zero problems on an unformatted repo is a configuration that checks nothing.
- `pnpm test` must still print `Tests  351 passed (351)`, proving the config touched no source.

## Done when

```bash
node -e "process.exit(require('./package.json').scripts.lint ? 0 : 1)" && echo "lint script: present"
pnpm lint ; echo "exit=$?"
git diff --stat -- src/ | tail -1
```

`lint script: present` prints, `pnpm lint` runs and reports findings with a non-zero `exit=`, and
`git diff --stat -- src/` prints nothing — no source file changed.

The first line is the whole point: a missing script and a linter with findings both exit 1, so the
exit code alone proves nothing. Run today, the block prints no `lint script: present`, then
`[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "lint" not found`, `exit=1` and an empty diff —
exactly what the earlier one-liner accepted as done.

## If stuck

If the tool cannot be configured to report without also rewriting, run it with its check/dry-run
flag in the `lint` script and add the writing variant as `lint:fix`. Every candidate here has both
modes; if the chosen one does not, that is a reason to pick a different one, not to merge a reformat
into this commit.

## Outcome

Shipped 2026-09-04. `pnpm lint` and `pnpm lint:fix` exist, `biome.json` lands alone, and nothing
under `src/` changed.

`Done when` block, run today:

```
lint script: present
exit=1
                                    ← git diff --stat -- src/ printed nothing
```

`pnpm typecheck` clean. **`pnpm test` prints `Tests  355 passed (355)`, not the 351 this plan
asked for** — the plan was written before [[slice-02-pilot-anime-service]] added four tests for the
new ports. 355 is the number to hold from here; the check it was making (that the config touched no
source) is satisfied by the empty `git diff -- src/` on the line above.

### The tool, and why

**Biome 2.5.12**, as the `Needs` section defaulted to. One binary doing both jobs, no plugin chain
for TypeScript, and both modes in the same command — `biome check` reports, `biome check --write`
rewrites — which is exactly what a slice that must not reformat needs. The alternatives were priced,
not dismissed: ESLint 10 needs `typescript-eslint` plus a separate Prettier to cover formatting at
all, and oxlint 1.81 does not format, so it would have taken Prettier alongside it and left the
`If stuck` branch as the only way to keep this commit clean.

### The config is not neutral, and each value was measured

Set to what the codebase already does, so that slice 2's diff is about real formatting rather than a
style the repo never used:

| setting | value | evidence |
|---|---|---|
| `indentStyle` / `indentWidth` | space, 2 | 0 files indent with tabs; the indent-length histogram of `src/` is 2/4/6/8, clean multiples of two |
| `quoteStyle` | single | 767 single-quoted imports in `src/` + `tests/`, **0** double-quoted |
| `semicolons` | always | 3,208 statement-terminating `;` in `src/` |
| `lineEnding` | lf | `src/`, `tests/` and `scripts/` are LF. `site/` and `docs/` are CRLF by origin and are **excluded**, so slice 2 cannot flip them |

`lineWidth` is the one real choice, priced across four candidates:

| lineWidth | files reformatted (of 225) | lines over the limit (of 11,059) |
|---|---|---|
| 80 | 173 | 2,941 (27%) |
| 100 | 156 | 1,340 (12%) |
| **120** | **139** | **780 (7%)** |
| 160 | 108 | 342 (3%) |

120 taken. The pitch's complaint is a 747-character handler line, not an 85-character one; at 80 the
reformat would rewrite three quarters of the repo to catch it.

**`files.includes` is an allowlist, not a set of exclusions** — `src/**/*.ts`, `tests/**/*.ts`,
`scripts/**/*.mjs`, the two vitest configs and four root JSON files. An ignore list would have let
`tests/fixtures/*.html` (byte-for-byte excerpts of real MyAnimeList pages), `.kanban.json` (written
by the `kanban` binary) and the CRLF files in `site/` in by default, and any of the three being
touched by slice 2 is silent corruption.

**`organizeImports` is off**, against Biome's default. Reordering imports changes evaluation order,
which is a semantic change wearing formatting clothes; slice 2 is supposed to be a diff a reviewer
can skim. Turning it on is its own decision with its own commit.

**`--error-on-warnings` is on both scripts**, per the `lint` skill: a warning that does not fail the
build is a comment, not a warning.

### What the first run found

139 of the 139 errors are **formatter** diffs — that is slice 2's whole diff, now measured instead of
guessed. The 23 warnings and 2 infos are real lint findings, in seven rules:

| rule | count |
|---|---|
| `correctness/noUnusedPrivateClassMembers` | 10 |
| `style/noNonNullAssertion` | 9 |
| `style/useTemplate` | 2 |
| `suspicious/noUselessEscapeInString` | 1 |
| `performance/noAccumulatingSpread` | 1 |
| `correctness/noUnusedImports` | 1 |
| `correctness/noUnusedFunctionParameters` | 1 |

The eleven `correctness/` hits are dead code `tsc --noEmit` never had an opinion about — the hole the
pitch said this epic exists to close, now with a count.

### CI stays untouched, as the plan required

`.github/` still runs only the suite. Wiring `lint` in while 139 files are unformatted would teach
everyone to ignore a red CI; it belongs after slice 2.

---

Closed by [[linter-formatter-and-app-ts]] (`docs/postmortem/`).
