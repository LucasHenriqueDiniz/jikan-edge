---
status: todo
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
pnpm lint ; echo "exit=$?" && git diff --stat -- src/ | tail -1
```

`pnpm lint` runs and reports findings, `exit=` is non-zero, and `git diff --stat -- src/` prints
nothing — no source file changed.

## If stuck

If the tool cannot be configured to report without also rewriting, run it with its check/dry-run
flag in the `lint` script and add the writing variant as `lint:fix`. Every candidate here has both
modes; if the chosen one does not, that is a reason to pick a different one, not to merge a reformat
into this commit.
