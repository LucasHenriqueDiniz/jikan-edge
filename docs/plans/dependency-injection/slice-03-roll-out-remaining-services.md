---
status: todo
kanban: 1287c82e-42b1-4d1e-a261-50ca5fed4c18
---

# Slice 3 — Roll the pilot across the remaining services

## Delivers

No service constructs an adapter. All construction happens in the ten factory functions at
`src/app.ts:111-120`, and no service constructor mentions `D1Database`.

14 remaining files in `src/services/` follow the shape slice 2 settled.

## Needs

- Slice 2 merged and its port shape unchanged for at least one other service. If the second service
  needs a different shape, the pilot did not settle anything and this slice is premature.
- A note on ordering: `src/services/cacheable.ts` is shared by every service through `CacheDeps`, so
  change it once and let the rest follow rather than per-service.

## Tests

- `pnpm test` at 351 or above throughout — this slice can be split per service and each split ends
  green. If a service cannot be converted with the suite green, it is the one that disproves the
  port shape; stop there.
- `pnpm test:integration` runs too, once at the end. The unit suite uses fakes and would not notice
  a wiring mistake in `src/app.ts`.
- No new tests beyond the per-service construction test slice 2 established.

## Done when

```bash
! grep -rqE "new [A-Za-z]*Repository\(|new MalClient\(" src/services/ && ! grep -rq "D1Database" src/services/ && pnpm typecheck && pnpm test
```

Both greps print nothing and do not short-circuit, `tsc --noEmit` prints nothing, and the run ends
with at least `Tests  351 passed`.

## If stuck

If this stalls halfway — some services converted, some not — that is a shippable state, not a
failure. Leave the converted ones converted, set this slice back to `todo` with a note listing which
services remain, and do not revert. A partially applied convention that is written down beats a
revert that loses the work.
