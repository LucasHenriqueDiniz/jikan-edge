---
status: todo
kanban: 9eda949b-6e1f-4cae-bb1e-dccc18d111d2
---

# Slice 2 — Take the reformat as its own commit

## Delivers

`pnpm lint` exits zero on a clean tree, and CI runs it. The commit that does this contains only
tool-generated changes — no hand edit rides along.

`src/app.ts` is the file this hurts on: 550 lines whose longest is 747 characters, because route
handlers are written one per line. Expect it to grow substantially in line count while changing not
at all in behaviour.

## Needs

- Slice 1 merged, so the config is already in history and this diff is purely the rewrite.
- A clean working tree and no open branches worth rebasing. This commit conflicts with everything.
- Rules the formatter cannot fix — unused variables, floating promises — split out into a second
  commit of hand fixes. Do not mix them in; the value of this commit is that it can be reviewed by
  reading zero lines of it.

## Tests

- `pnpm test` at exactly `Tests  351 passed (351)`, before and after, from an untouched `tests/`
  tree. This is the entire safety argument: the formatter changed only whitespace and syntax, so an
  identical pass count is the proof.
- `pnpm typecheck` clean.
- No new tests. A formatter has no behaviour to cover.

## Done when

```bash
pnpm lint && git status --porcelain && pnpm test
```

`pnpm lint` exits zero with no findings, `git status --porcelain` prints nothing, and the run ends
with `Tests  351 passed (351)`.

## If stuck

If a lint rule produces hundreds of findings the formatter cannot fix, disable that rule in the
config with a comment naming what it flagged and how many. Turning it on later is one line; leaving
the repo unformatted because one rule is noisy is how this ends up not happening at all.
