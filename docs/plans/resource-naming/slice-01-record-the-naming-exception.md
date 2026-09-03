---
status: blocked
kanban: 93301641-fcc7-4af0-8263-cb36a7cae20b
---

# Slice 1 — Record why the Cloudflare resource names stay as they are

**Blocked on the owner: renaming these resources needs a Cloudflare account login and a decision to
break a public hostname the README promises to keep.** Neither is something an agent can do or
decide. The board leaves a blocked card in whatever column it sits in and carries no reason, so it
is written here.

## Delivers

A dated exception in `docs/architecture/`, or a section in `docs/architecture/initial-decisions.md`,
stating that `jikan-edge` (worker) and `jikan-edge` (D1) deliberately do not follow the
`<owner>-<project>-<resource>-<env>` convention, and what it would cost to change them.

The alternative deliverable — the rename itself — is the owner's call and is not in this slice.

## Needs

The three facts that make this the `naming` skill's asymmetric case, all verifiable now:

- `wrangler.jsonc:3` `"name": "jikan-edge"` is the `*.workers.dev` hostname. `README.md:21` promises
  `https://jikan-edge.lucas-hdo.workers.dev` "is not scheduled for removal". A worker rename breaks
  that; the custom domain `jikan.lucashdo.com` (`wrangler.jsonc:11`) is unaffected.
- `wrangler.jsonc:35-36` `"database_name": "jikan-edge"` with `"database_id": "71f8a596-…"`. A
  differently-named D1 is a different database, so renaming is create-migrate-cutover against a live
  account, not a config edit.
- `scripts/setup.mjs` rewrites the database id for forks. Whatever names are chosen, it has to keep
  working — check it before proposing anything.

## Tests

- None; this slice writes a document.
- Done means a reader who finds the naming gap in a future audit finds the reason in the same search.
  If the note does not name both resources and both costs, it will not do that job.

## Done when

```bash
for f in docs/architecture/*.md; do grep -q "workers.dev" "$f" && grep -q "database_name" "$f" && echo "both costs named in $f"; done
```

One line prints, naming the file that carries the exception — whether that is a new dated note
or a section in `initial-decisions.md`, both of which this folder's glob covers.

Both strings have to be in the *same* file, which the two independent `grep -r` calls did not
require: one file naming the hostname and a different one naming the database would have satisfied
them, and `grep -rc` printed a `:0` line for every file mentioning neither, so the output looked
like an answer either way. Today nothing prints — no file under `docs/architecture/` contains
`workers.dev`.

## If stuck

If the owner decides to rename after all, this slice becomes obsolete and the rename gets its own
plan with a cutover checklist. Do not attempt both in one slice: a documented exception and a live
resource migration have nothing in common except the sentence that prompted them.
