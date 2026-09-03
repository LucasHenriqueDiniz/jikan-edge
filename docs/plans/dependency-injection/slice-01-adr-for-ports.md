---
status: todo
kanban: 88a59431-9505-4d3b-a473-57f75ec684a2
---

# Slice 1 — Write the ADR that decides whether ports are worth it

## Delivers

`docs/architecture/adr-ports-for-driven-dependencies.md`, status `Proposed`, costing both options
against numbers taken from this repo rather than from the skill. Nothing under `src/` changes. If
the Needs section's alternative is taken the file is `docs/adr/adr-ports-for-driven-dependencies.md`
instead — the gate accepts either folder under that filename, so the choice does not change it.

The ADR has to answer three things the audit could not:

1. **What the change actually costs.** 15 files in `src/services/`, 12 in `src/repositories/`, and
   11 factory functions at `src/app.ts:111-121` that today hand each service a raw `c.env.DB` —
   plus two more callsites the factories miss, `new RandomService(c.env.DB)` at `src/app.ts:530`
   and `:540`.
2. **What it buys that is not already banked.** Eleven of the twelve services that take a
   `D1Database` already take an optional `source?: MalClient` too, so tests can pass a fake
   (`src/services/anime.service.ts:59`); `RandomService` is the one that does not. Ports would make
   that uniform, not newly possible — say so plainly instead of claiming testability.
3. **Whether a second adapter is plausible.** On Workers the alternative to D1 is another D1. If the
   port exists only to satisfy the rule, the ADR should say that and let the owner decide anyway.

## Needs

- The `architecture` skill's two rules, quoted so the ADR argues with the actual text.
- `docs/architecture/` as the location. `docs/README.md` lists `adr/` as reserved for "formal
  architecture decisions once there are mature alternatives"; this decision has exactly two mature
  alternatives, so it can seed that folder instead if the owner prefers. Pick one and write it down.

## Tests

- None. This slice produces a document; there is no code to test.
- The definition of done is that the four ADR sections exist and each option carries a number from
  this repo, not an adjective. An option costed as "significant refactor" fails this slice.

## Done when

```bash
ADR=$(ls docs/architecture/adr-ports-for-driven-dependencies.md docs/adr/adr-ports-for-driven-dependencies.md 2>/dev/null | head -1) ; echo "adr=$ADR"
test -n "$ADR" && test "$(grep -cE '^## (Context|Options|Decision|Consequences)' "$ADR")" = 4 && grep -c "src/services/anime.service.ts" "$ADR" && echo "ADR costed against this repo"
```

`adr=` names the file, the citation count prints at least `1`, and `ADR costed against this repo`
closes the chain.

The section count is asserted at exactly `4` rather than printed: `grep -c` exits zero on `3` too,
so a draft missing `Consequences` used to pass by inspection. Looking the file up in both allowed
folders is the other half — the old command hard-coded `docs/architecture/`, which the Needs
section's own `docs/adr/` option would have failed. Today `adr=` is empty and nothing else runs.

## If stuck

If writing it honestly makes the answer obviously "no", write "no" and mark the ADR `Rejected`. Then
set slices 2 and 3 to a status of `done` with a one-line note pointing at the ADR, and close the
epic. A recorded refusal is a valid outcome of this slice — the failure mode is leaving the question
open for the next audit to raise again.
