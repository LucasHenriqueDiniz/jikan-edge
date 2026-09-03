---
status: todo
kanban: 1287c82e-42b1-4d1e-a261-50ca5fed4c18
---

# Slice 3 — Roll the pilot across the remaining services

## Delivers

No service constructs an adapter. All construction happens in the eleven factory functions at
`src/app.ts:111-121`, and no service constructor mentions `D1Database`.

11 files in `src/services/` still name `D1Database` once slice 2 has converted
`anime.service.ts`, and all of them follow the shape it settled: ten that build their own
repositories and `MalClient`, plus `random.service.ts`, which builds nothing but takes a raw
`D1Database` straight into `this.db.prepare(...)`.

`RandomService` is also the one service with no factory — `src/app.ts:530` and `:540` do
`new RandomService(c.env.DB)` inline inside the two random route handlers. Giving it a factory
alongside the other eleven is part of this slice, not a detail: without that, `src/services/`
cannot stop naming `D1Database`.

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
! grep -rqE "new [A-Za-z]*Repository\(|new MalClient\(" src/services/ && ! grep -rq "D1Database" src/services/ && ! grep -qE "new [A-Za-z]+Service\(c\.env\.DB" src/app.ts && echo "no service builds an adapter; none is handed a raw D1" && pnpm typecheck && pnpm test
```

All three greps find nothing, the marker line prints, `tsc --noEmit` prints nothing, and the run
ends with at least `Tests  351 passed`.

The third grep is what keeps the composition root in scope. It matches 13 sites today — the eleven
factories and the two inline `new RandomService(c.env.DB)` calls — so it cannot be satisfied by
rewriting the factories and leaving the random routes alone, which is the state the first two greps
would happily accept. Today the block stops at the first grep and prints nothing.

## If stuck

If this stalls halfway — some services converted, some not — that is a shippable state, not a
failure. Leave the converted ones converted, set this slice back to `todo` with a note listing which
services remain, and do not revert. A partially applied convention that is written down beats a
revert that loses the work.
