---
status: todo
kanban: 2feb8489-3fcc-481b-97a6-9d7b06be9f68
---

# Slice 3 — Split app.ts below the soft limit

## Delivers

`src/app.ts` under 500 lines, the soft limit in the `clean-code` skill, with routes grouped into
modules that mount onto the same Hono app. Every route keeps its path, its response shape and its
cache headers.

## Needs

- Slice 2 merged. Splitting a formatted file produces a diff where moved lines are recognisable as
  moved; splitting an unformatted one does not.
- A seam. The obvious one is by resource — the eleven factory functions at `src/app.ts:111-121`
  already group the routes by service (`user`, `anime`, `manga`, `character`, `producer`, `club`,
  `person`, `watch`, `recommendation`, `review`, `search`). `RandomService` has no factory: the two
  random routes construct it inline at `src/app.ts:530` and `:540`, so the random routes have no
  seam to follow and stay where they are unless this slice gives them one.
- `src/app.ts` also carries the composition root. It stays there whatever else moves; that is the
  one thing that is supposed to be in one place.

## Tests

- `pnpm test` at 351 passing and `pnpm test:integration` green. The integration suite exercises real
  routes, which is what would catch a route silently unmounted by the split.
- The route contract in `docs/routes.md` is the reference for what must still answer. If a route
  moves module but changes behaviour, the docs change is part of this slice.
- No new tests. This is a move; new coverage would be a different slice.

## Done when

```bash
wc -l src/app.ts && test "$(wc -l < src/app.ts)" -lt 500 && pnpm test && pnpm test:integration
```

`wc -l` prints a number below 500, the unit run ends with `Tests  351 passed (351)`, and the
integration run reports no failures.

The `test` carries the condition because `wc -l` exits zero at any size: without it both suites run
on the unsplit file and the block ends green while `app.ts` is still 550 lines. Today it prints
`550 src/app.ts` and the chain stops there.

## If stuck

If no seam gets `app.ts` under 500 without inventing an indirection nobody asked for, stop and leave
it at 550. The hard limit is 1500; 550 is a candidate, not a defect. Record which seams were tried
and why each was worse, and close the slice as `done` with that note — a file kept large on purpose
is a decision, and undocumented is the only version of it that is wrong.
