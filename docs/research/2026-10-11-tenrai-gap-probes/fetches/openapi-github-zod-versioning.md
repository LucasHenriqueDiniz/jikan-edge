---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/versioning.mdx
fetched: 2026-10-11
kind: primary
---

# Zod docs: Versioning (zod 4)

> Fetched 2026-10-11 · Read to understand what the installed 3.25.76 contains (the `zod/v4`
> subpath) and what upgrading to the `zod@4` package changes in imports.

## What it says

> "The package root ("zod") now exports Zod 4. All other subpaths have not changed and will remain available forever."

The import table: Zod 4 moves from `"zod/v4"` to `"zod"`; Zod 3 moves from `"zod"` to `"zod/v3"`.

> "No code changes were made between the latest `3.25.x` release and `4.0.0`."

On the 3.25 transition:

> "Zod 4 will not initially be published as `zod@4.0.0` on npm. Instead it will be exported at a subpath (`"zod/v4"`) alongside `zod@3.25.0`"

> "A Zod 3 `ZodType` is not assignable to a Zod 4 `ZodType`."

## What it does not say

- What the upgrade costs a particular codebase. Measured for this repo instead (report): with the
  root import left as is and the package moved to 4.6.5, `tsc` and all 355 unit tests stayed green.
