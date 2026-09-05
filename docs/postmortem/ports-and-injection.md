---
tags:
  - postmortem
  - kind/plan
  - area/architecture
  - ports
  - dependency-injection
  - checkpoint-gates
closed: 2026-09-04
---

# Ports and injection, from the ADR to the last service

> Closed 2026-09-04 · jikan-edge@3b56385 · plans: [[slice-01-adr-for-ports]], [[slice-02-pilot-anime-service]], [[slice-03-roll-out-remaining-services]] · pitch: [[pitch-ports-and-injection]] · decision: [[adr-ports-for-driven-dependencies]] · follows [[ports-for-driven-dependencies]]

This closes the epic. [[ports-for-driven-dependencies]] covered slices 1 and 2 the day they shipped;
this one is what the third slice added and what the whole arc cost.

## What is actually true now

| | before the epic | after |
|---|---|---|
| services taking ports | 0 of 12 | **12 of 12** |
| services constructing adapters | 12 | 0 |
| services with no factory | 1 (`RandomService`, built inline in two handlers) | 0 |
| `D1Database` in `src/services/` | 12 files | none, comments included |
| ports | none | 2 — `CatalogSource`, `CatalogStore` |
| tests | 351 unit | 355 unit, 29 integration, all passing |

## The three decisions that were made by doing, not by deciding

1. **How many ports.** The ADR could not settle it; the pilot did. Two, one per driven
   conversation — not five (one per repository) and not twelve (one per service). The house style
   names port explosion as the failure mode and this is where that stopped being abstract.
2. **Grouped members, not a flat interface.** The ADR costed the store as "one interface carrying
   the 28 public methods", which read literally means flat — and flat collides, because `get` and
   `put` mean four different things here. Nesting was not in the ADR; it is what let the pilot stay
   a pilot, because `CacheDeps` could project the two members `withCache` needs straight out of the
   port type and the other eleven services satisfied it structurally without changing a line.
3. **A generic member where the resources are genuinely the same conversation.** Slice 3's first
   draft wrote out six near-identical members for the six detail resources; `DetailStore<T>` says
   the same thing in a fifth of the lines, and a reader does not have to compare them character by
   character to see they are identical.

## The mistakes, in the order they were made

1. **A `Done when` chain joined with `;`.** The grep short-circuited on the very line it was meant
   to catch, and the suite ran anyway — so an untouched repo printed the same last line as a
   finished one.
2. **`grep -c` asserting a section count**, which exits zero on 3 as well as on 4, so a draft ADR
   missing `## Consequences` passed by inspection.
3. **A gate that greps text cannot tell a comment from code.** Slice 2 hit it from one side: a
   comment quoting an old constructor failed a file that was already correct. Slice 2 wrote that
   down as a note for slice 3 — and slice 3 hit it twice anyway, the second time on the comment
   written to explain the first failure, which quoted the two names it was warning about.
4. **A field kept for symmetry that was dead in seven of ten services.** `private readonly cache`
   survived the conversion because `AnimeService` has one; only three services ever read it.

## What worked

- **Refusing to claim testability.** Eleven of twelve services already took an optional
  `source?: MalClient` so tests could pass a fake. The ADR said plainly that ports make that
  *uniform*, not newly possible. An honest ADR is one a reader can disagree with.
- **Deleting the optional parameter rather than retyping it.** A dependency defaulting to a real
  adapter is a composition root hiding in a constructor, and it was also what let a test pass a
  stand-in the compiler never checked.
- **Verifying the tripwire instead of asserting it.** Temporarily retyping `refreshLeases.acquire`
  as `Promise<D1Result>` produced 16 compile errors including one inside the new port test, then
  the change was reverted. That is what makes the test evidence rather than decoration.
- **Checking the stop condition first.** The ADR asked whether any port signature would end up
  carrying a driver type. `refreshLeases.acquire` was the real doubt — the adapter decides from
  `result.meta.changes`, and handing the `D1Result` back for the caller to interpret would have been
  the driver with an interface in front of it. It answers `boolean`.
- **A permissive fake would have been easier and wrong.** The nine members `AnimeService` does not
  read throw when touched, so a service quietly starting to depend on one fails loudly instead of
  passing against an empty map.

## What did not

**`RandomService` was in the plan as a detail and was actually the load-bearing part.** It was the
one service with no repository — raw SQL against the binding — which is why it was also the one with
no factory. `src/services/` could not stop naming the binding type until it had a repository, and
the composition root could not own all construction until it had a factory. Neither of the first two
slices could have finished the job without it.

**The plans' test counts went stale on the board.** All three said 351; the suite has been at 355
since slice 2 added the port test. Each slice recorded the gap rather than editing the plan, because
the check the number was making still held.

## What changed so it cannot recur

| was | is now |
|---|---|
| twelve services reaching for their own adapters | twelve receiving them; `src/app.ts` is the only place that constructs |
| a service that could be handed a real adapter by default | no optional dependency; the compiler requires the caller to supply one |
| a port's conformance argued in prose | `D1CatalogStore implements CatalogStore` is the single conformance point, and drift fails at the adapter naming the member |
| `RandomService` built inline in two route handlers | a factory beside the other eleven |
| `RandomKind` derived from a service's private table map | `src/domain/random.ts`, so the port does not import a service to name its own argument |
| a gate joined with `;` | joined with `&&`, and it prints nothing on an untouched repo |
| an epic closed with three plan files and no record | this document, and the pitch beside it |

## Still open

- **`SourceResult` and `FetchBudget` still live in `src/source/`**, so `CatalogSource` imports from
  its own adapter's directory — the port points outward. `CacheEntry` was moved into the store port
  for exactly this reason; these two were left because `fetch-policy.ts` holds real policy alongside
  the type.
- **The store port imports `Favorites` and `UserUpdates` from `src/parsers/`.** Domain shapes that
  never made it to `src/domain/`; the domain-boundary pitch is what moves them.
- **`src/domain/pagination.ts` imports `ServiceError` from `../services/cacheable`** — still the one
  arrow in the tree pointing outward, and still the next slice.
