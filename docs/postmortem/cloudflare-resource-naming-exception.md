---
tags:
  - postmortem
  - kind/plan
  - area/infra
  - naming
  - blocked-on-owner
  - checkpoint-gates
closed: 2026-09-03
---

# The Cloudflare resource names stay — a card that was an answer, not work

> Closed 2026-09-03 · jikan-edge@8b833c4 · plan: [[slice-01-record-the-naming-exception]] · decision: [[adr-cloudflare-resource-names]] · pitch: [[pitch-cloudflare-resource-naming-exception]]

⚠️ **Written retroactively on 2026-09-04**, from `git log` and the plan's own `Outcome` section.

## What was planned

A dated exception under `docs/architecture/` stating that `jikan-edge` (Worker) and `jikan-edge`
(D1) deliberately do not follow `<owner>-<project>-<resource>-<env>`, and what changing them would
cost. The alternative deliverable — the rename itself — was explicitly the owner's call and out of
the slice.

## What is actually true

**The deliverable already existed when the card was unblocked.**
`docs/architecture/adr-cloudflare-resource-names.md` had landed the day before at `b28d066` (140
lines), headed *"Accepted, as an exception. The names do not change."* The closing commit `8b833c4`
changed **one file by 22 lines** — the plan's own `Outcome` section — and nothing else.

So the card was never work waiting to be done. It was a document waiting to stop being provisional,
and the missing input was one sentence from the owner: *keep the names*.

Both costs are on record, which is what the slice actually required:

| resource | what a rename costs |
|---|---|
| Worker `jikan-edge` | it **is** the `*.workers.dev` hostname, and `README.md:21` promises `https://jikan-edge.lucas-hdo.workers.dev` "is not scheduled for removal". The custom domain `jikan.lucashdo.com` survives a rename; that hostname does not |
| D1 `jikan-edge` | a differently-named D1 is a *different database*. Create → migrate → cutover against a live account, not a config edit |

`scripts/setup.mjs`, which rewrites the `database_id` for forks, keeps working — because nothing was
renamed.

## The mistake

**The gate was two independent `grep -r` calls, and it could not fail usefully.** One file naming the
hostname and a *different* file naming the database would have satisfied both. Worse, `grep -rc`
printed a `:0` line for every file mentioning neither, so the output looked like an answer whichever
way it went — a wall of `:0` reads as "it ran", not as "it found nothing".

The corrected form loops over `docs/architecture/*.md` and requires **both strings in the same
file**. Run before the ADR existed, it printed nothing at all.

## What worked

**Writing the blocked-on reason into the plan rather than the board.** The board leaves a blocked
card in whatever column it sits in and carries no reason; a card reading `Todo` for three weeks
because it needs a Cloudflare login and a decision to break a public hostname is indistinguishable
from a card nobody picked up. The plan file said which it was.

**Refusing to bundle.** The `If stuck` branch declared, before it was needed, that if the owner chose
to rename, this slice becomes obsolete and the rename gets its own plan with a cutover checklist —
never both in one slice. That branch did not fire, but it is why the closing commit is 22 lines and
not a migration.

## What changed so it cannot recur

| was | is now |
|---|---|
| two independent `grep -r` calls, satisfiable by two different files | one loop requiring both strings in the same file |
| `grep -rc`, whose `:0` output reads as a result | no count printed; the gate prints one line naming the file, or nothing |
| an audit finding the naming gap and re-raising it | [[adr-cloudflare-resource-names]] answers it in the same search — that is the whole job of the document |
| a blocked card silently indistinguishable from an ignored one | the blocking reason lives in the plan file, above the fold |

## Still open

Nothing for this pitch. The gap itself is permanent and deliberate: an audit **will** keep finding
that these names do not follow the convention, and the ADR is the answer it should find. If the
owner ever reverses that, the rename needs its own plan with a cutover checklist — not an edit to
this one.
