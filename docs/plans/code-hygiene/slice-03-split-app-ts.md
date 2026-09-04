---
status: done
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

## Outcome

Shipped 2026-09-04. `src/app.ts` is **197 lines**; the 93 route registrations live in twelve modules
under `src/http/routes/`, largest 426 lines. Nothing under `src/` is over the soft limit.

`Done when` block: prints `197 src/app.ts`, the `-lt 500` test passes, unit run ends
`Tests  355 passed (355)` and the integration run `Tests  29 passed (29)`. (355, not the 351 this
plan asked for — the same stale number as slices 1 and 2, predating the ports pilot's four tests.)

### The `If stuck` branch was written against a premise that had expired

It said: if no seam works, leave it at 550, because *the hard limit is 1500 and 550 is a candidate,
not a defect.* By the time this slice ran, slice 2's reformat had taken the file to **1,782 lines** —
past the hard limit, so the escape hatch no longer existed.

That is not the reformat inflating the file. Those 558 lines contained handlers written one per line
at up to 747 characters; the reformat is what made the real size visible. **A plan's fallback can go
stale between being written and being needed** — check the condition it rests on rather than the
conclusion it reached.

### The seam

By resource, as the `Needs` section predicted, plus one sub-seam it did not: `anime` came out at 511
lines on the first pass, so `seasons` and `schedules` (5 routes, both fed by `AnimeService`) became
their own module.

| module | routes | | module | routes |
|---|---|---|---|---|
| `anime` | 23 | | `watch` | 4 |
| `manga` | 17 | | `producers` | 4 |
| `users` | 12 | | `random` | 2 |
| `people` | 9 | | `recommendations` | 2 |
| `characters` | 8 | | `reviews` | 2 |
| `clubs` | 5 | | | |
| `seasons` | 5 | | **total** | **93** |

**The composition root stayed in `app.ts`**, as the plan required: the twelve service factories are
still there, and each module receives the ones it needs as `deps` and destructures them on its first
line. That destructuring is why every handler body is byte-identical to before — the names in scope
did not change.

`background()` and `cacheHeader()` had to move, into `src/http/app-context.ts` alongside the `App`
and `AppContext` types. Leaving them in `app.ts` would have made every route module import the app
that imports it. They are HTTP helpers, not composition, so this is not the root leaking.

### The split was scripted, and that is the point

93 handlers retyped by hand is where a route silently changes shape. A generator sliced the route
region at each registration, attached each block's own leading comments, grouped by path, and emitted
the modules with the bodies untouched. Rerunnable from the pre-split file, which is what made
"generate, look, adjust the seam, regenerate" cost nothing.

⚠️ **The generator's first run was wrong in a way that compiled to 25 errors, which is the good
case.** It decided which factories a module needed with ``new RegExp(`\\b${name}\\b`)`` where `name`
was `watchService(c)` — and `(c)` in a regex is a capture group, not two literal parentheses. Every
module came out with no `deps` parameter. It failed loudly at `tsc`; had the same class of mistake
landed inside a handler body it would have failed silently. Matching source text wants
`String.includes`, not a regex, unless the regex is doing something a substring cannot.

### Proof that no route moved

`tsc` and 384 passing tests are necessary, not sufficient — a route registered under a wrong path
still compiles. So the app's own `app.routes` table was dumped before and after and compared:

**198 entries, identical, method by method and path by path** (97 `GET /v1/*` plus the middleware
and `ALL` rows). The dump was checked non-empty first, after the lesson from slice 2.

### Note for DI slice 3

`random.routes.ts` is now the only module that builds a service instead of receiving a factory —
`new RandomService(c.env.DB)`, twice. It is the one service with no factory in `app.ts`, and the
split made that visible instead of leaving it buried at line 538 of a 1,782-line file.
