# User-list hardening — Slice 02: curate a diverse corpus and probe it

> **For agentic workers:** implement task-by-task. Slice 2 of 3. Depends on slice 01 (the probe
> harness). This slice **is** the research step of the loop — its output is the evidence that makes
> the fix slices concrete.

**Goal:** Assemble a profile list deliberately spanning the axes that change parsing, run the slice-01
probe against it on the real edge, and produce a **divergence report** naming every profile whose
assembled count does not match its `totalEntries` (or that errors), with the raw HTML kept.

**Spec:** [../../pitches/user-lists-multi-profile-hardening.md](../../pitches/user-lists-multi-profile-hardening.md)

**Architecture / decision:** No production code. This is measurement that produces a research note.
Each divergence it finds becomes one fix slice (slice-03 template). It intentionally does **not** fix
anything — separating "what is actually true" (this slice) from "what we change" (fix slices) is the
whole point of the loop, and it stops fixes being invented against profiles no one has looked at.

**Tech stack:** `wrangler dev --remote`, the slice-01 probe, Node for HTML capture.

## Global constraints

- Same as slice 01: only MAL, remote-edge probe only, no internal endpoints, UTF-8-safe file writes.
- Raw captured HTML goes under `docs/research/user-list-corpus/fetches/` (the `research` skill's
  layout: one directory, every source under `fetches/`).

---

## Task 1: Curate the corpus along the parsing axes

**Files:**
- Create: `docs/research/user-list-corpus/corpus.md` (the username list + why each was chosen)

- [ ] **Step 1: Choose profiles spanning each axis, one line of rationale each**

Cover, at minimum, one profile per axis the pitch names — do not pad with similar users:

| Axis | Target | How to find one |
|------|--------|-----------------|
| Layout | classic **and** modern | the five known cover both; add 1 more of each |
| Size | empty list; small (<50); large near 6,000 | MAL "Users" directory / known big listers |
| Title shape | numeric title (`86`, `1`); CJK; RTL (Arabic/Hebrew); quotes/entities | search those titles, find a list containing them |
| Entry state | airing with `-` total; plan-to-watch; on-hold/dropped | any active watcher's list |
| Privacy/style | custom-CSS list; tag columns; shared/restricted; fully private | community profiles known for custom CSS |

Record each as `username — axis — expectation`. Aim for ~12–20 profiles, not hundreds (the probe
fires real MAL requests; note the count you chose and why in the doc).

- [ ] **Step 2: Commit the corpus list**

```bash
git add docs/research/user-list-corpus/corpus.md
git commit -m "docs(lists): curate a diverse user-list probe corpus"
```

## Task 2: Probe the corpus and capture divergences

**Files:**
- Create: `docs/research/user-list-corpus/findings.md`
- Create: `docs/research/user-list-corpus/fetches/<username>-<media>.html` (raw, only for divergent
  profiles)

- [ ] **Step 1: Run the probe against the corpus on the remote Worker**

```bash
npx wrangler dev --remote --port 8788   # background; wait for /health
node spikes/list-probe/probe.mjs $(node -e "/* print usernames from corpus.md */")
```

- [ ] **Step 2: For each divergence, capture the raw page and pin the cause**

A divergence is: count ≠ `totalEntries`, or an unexpected 502/501/500, or a field that is wrong
(diff field-by-field on a sample, not just the count — silent field corruption is the failure mode
this project has hit before). For each, save the raw list HTML MAL served (fetch the same
`?status=7` URL the service uses, via the remote path) under `fetches/`, and write the suspected
cause: which layout, which field, which regex/`data-items` assumption it breaks.

- [ ] **Step 3: Write the findings note with a verdict per divergence**

For each divergence: profile, axis, observed vs expected, suspected root cause, and **whether it is a
real bug or a correct-but-surprising result** (e.g. a legitimately private list that *should* be a
502). End with an ordered list of the fix slices to author — this list is the input to slice 03.
Include an "independent oracle" for each claimed count (the profile `totalEntries`, or a manual count
from the raw page), per the research rule that a probe result needs something other than the code
under test to confirm it.

- [ ] **Step 4: Commit the research note**

```bash
git add docs/research/user-list-corpus/
git commit -m "docs(lists): probe findings across the diverse corpus, with per-divergence verdicts"
```

## Verification (slice gate)

`findings.md` names every corpus profile, each marked match / real-divergence / deliberate-non-200,
with raw HTML kept for every divergence and an ordered fix-slice list at the end. If the corpus is
all-green, that is itself the result — record it and the hardening is done without code changes.
