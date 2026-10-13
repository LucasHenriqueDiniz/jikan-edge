---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/asteasolutions/zod-to-openapi/v7.3.4/README.md
fetched: 2026-10-11
kind: primary
---

# zod-to-openapi README at tag v7.3.4 (the last zod v3 line)

> Fetched 2026-10-11 · The README as it stood at the version this repo could install without
> upgrading zod. Read to check what 7.3.4 requires of the caller, since the latest README describes 9.x.

## What it says

The `.openapi()` method needs a one-time prototype extension:

> "For this to work, you need to call `extendZodWithOpenApi` once in your project."

> "This should be done only once in a common-entrypoint file of your project"

The supported zod major, in the "Technologies" list at the end:

> "Zod 3.x"

The same `registerPath` / `OpenAPIRegistry` / `OpenApiGeneratorV3` / `OpenApiGeneratorV31` API as 9.x
is documented (generators for OpenAPI 3.0.x and 3.1.x).

## What it does not say

- It is internally inconsistent: the code samples in "The basic idea" import `z` from `'zod/v4'`
  while the Technologies list says Zod 3.x and the package's peer range is `^3.20.2`. The measured
  run used the plain `'zod'` root import (zod 3.25.76, v3 API) with `extendZodWithOpenApi(z)` and
  worked, so the `'zod/v4'` lines read as a documentation slip, not a requirement.
- No support or end-of-life date for 7.x; the "not actively supported" statement lives only in the
  9.1.0 README.
