# Plans

A plan is **a directory of numbered vertical slices**, not a document.

```
plans/
└── <feature>/
    ├── slice-00-<name>.md
    ├── slice-01-<name>.md
    ├── slice-01b-<name>.md     ← reality intruded
    └── slice-02.1-<name>.md    ← so did this
```

**Every slice is small enough to ship on its own.** If a slice cannot end in something that runs, it is
not a slice, it is a layer, and layers are how a plan stops being executable.

**Fractional numbers are a feature.** `01b` and `02.1` are what a plan looks like after contact: an
unforeseen prerequisite, a walkthrough somebody needed, a case the original numbering had no room for.
Renumbering to keep it tidy destroys the record of what actually happened.

## Frontmatter

```yaml
---
status: todo         # todo | doing | blocked | done
kanban: <uuid>       # written by the `board` skill; do not edit
---
```

**Both keys are optional.** A slice with no frontmatter at all reads as `todo`, and gains the block the
first time something writes to it — so slices written before this existed need no migration. A repo
that does not use the `board` skill never sees `kanban:` at all.

## What a slice says

| field | |
|---|---|
| **Delivers** | what runs at the end that did not run at the start |
| **Needs** | what has to exist first, each with a time budget if it is reading |
| **Tests** | the list of tests *is* the definition of done |
| **Done when** | one command, and what its output must say |
| **If stuck** | the fallback, declared before you need it |

**A checkpoint ends in a command whose output is the pass or fail.** Not "the module is complete".

## Where a plan comes from

Research answers the question. A decision record says what was chosen and what it rules out. The plan
says in what order it gets built. See the `workflow` skill.

⚠️ **The plan is not the record of why.** When a plan and a decision disagree, the decision wins and the
plan is the stale one. Say so in the plan rather than quietly editing both.
