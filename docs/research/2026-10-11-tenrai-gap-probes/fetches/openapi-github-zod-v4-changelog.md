---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/changelog.mdx
fetched: 2026-10-11
kind: primary
---

# Zod docs: Migration guide (v3 to v4 changelog), on main

> Fetched 2026-10-11 · Read to estimate the cost of a zod 4 upgrade against the exact zod surface
> this repo uses (measured by grep over `src/`: `z.object` 69, `z.string` 246, `z.number` 109,
> `z.array` 34, `z.enum` 4, `z.boolean` 3, `.nullable` 201, `.url` 74, `.min` 67, `.int` 54,
> `.positive` 48, `.datetime` 9, `.max` 5, `.nonnegative` 1, `.safeParse` and one `z.ZodType<T>`).

## What it says

String formats became top-level functions; the method forms used here keep working:

> "The method forms (`z.string().email()`) still exist and work as before, but are now deprecated."

Numbers:

> "`POSITIVE_INFINITY` and `NEGATIVE_INFINITY` are no longer considered valid values for `z.number()`."

> "The `z.number().int()` API no longer accepts unsafe integers"

Generics:

> "The second generic `Def` has been entirely removed."

(`z.ZodType<Output, Def, Input>` becomes `z.ZodType<Output, Input>`; the one use in
`search.parser.ts`, `z.ZodType<T>`, compiles unchanged.)

`.merge()` on objects is deprecated in favour of `.extend()` (not used in `src/`).

## What it does not say

- Whether any of these bites this repo. Measured instead: moving the package to 4.6.5 with no
  source change gave 0 new `tsc` errors and 355 of 355 unit tests passing; a mutation of one schema
  turned the suite red, so the tests do exercise the schemas.
- Bundle size. Measured instead: `wrangler deploy --dry-run` went from 478.23 KiB / 84.91 KiB gzip
  (zod 3.25.76) to 1122.60 KiB / 183.95 KiB gzip (zod 4.6.5).
