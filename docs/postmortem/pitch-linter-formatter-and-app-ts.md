---
status: closed
epic: hygiene
---

> **Closed 2026-09-04.** Moved here from `docs/pitches/` so the pair reads as one thing: this is what
> was promised, [[linter-formatter-and-app-ts]] is what happened. The bet it made -- that sequencing
> the three slices is the whole reason to group them -- held.

# A linter, a formatter, and an `app.ts` under the soft limit

## The problem

**There is no linter and no formatter.** `ls -a | grep -iE 'eslint|prettier|biome|oxlint|editorconfig'`
returns nothing. The `package.json` scripts are `setup, og, dev, dev:local, deploy, test,
test:integration, test:watch, typecheck, build, db:migrate:local, db:migrate:remote, benchmark,
prepare` — `typecheck` is the only static check, and `tsc --noEmit` has no opinion about style,
unused values, or floating promises. The `lint` skill exists for exactly this hole.

**`src/app.ts` is 550 lines** (`wc -l src/app.ts`), past the 500-line soft limit in the `clean-code`
skill. The hard limit is 1500, so this is a candidate rather than a blocker. Its longest line is 747
characters: route handlers are written one per line.

## Why these are one epic and not two

Because turning a formatter on rewrites `src/app.ts`, and so does splitting it. Doing them in either
order without planning produces one diff where a 550-line reformat and a real structural change are
indistinguishable, and that diff is unreviewable. Sequencing them is the entire reason to group them.

The order chosen here: configure the tools in check-only mode first, so one commit carries config and
nothing else and you can see the size of what is coming; then take the reformat as its own commit
with no other change in it; then split `app.ts` against an already-formatted file.

## The bet

The reformat commit is ugly and unavoidable. It is worth taking once, now, while the repo is one
person's, rather than later against open branches.
