---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/colinhacks/zod/v3.25.76/packages/docs/content/json-schema.mdx
fetched: 2026-10-11
kind: primary
---

# Zod docs: JSON Schema, at tag v3.25.76 (the installed version)

> Fetched 2026-10-11 · Read to see what `z.toJSONSchema` can do in the `zod/v4` subpath of the exact
> version this repo has installed, not the latest docs.

## What it says

> "Zod 4 introduces a new feature: native JSON Schema conversion."

The sample imports `* as z from "zod/v4"`, i.e. it applies to v4 schemas only.

Targets available in this version (`ToJSONSchemaParams`): `target?: "draft-7" | "draft-2020-12"`, and

> "By default, Zod will target Draft 2020-12."

> "By default, the result of `z.toJSONSchema` represents the *output type*"

> "When converting to JSON Schema in `"input"` mode, `additionalProperties` is not set."

Types with no JSON Schema analogue throw by default (`z.date()`, `z.transform()`, `z.bigint()` and
others are listed); none of them appears in this repo's response schemas.

## What it does not say

- An `openapi-3.0` target: it does not exist in 3.25.76 (confirmed in
  `node_modules/zod/v4/core/to-json-schema.d.ts`: `target?: "draft-7" | "draft-2020-12"`). Draft
  2020-12 is the dialect OpenAPI 3.1 uses, so a 3.1 document is reachable; a 3.0 one is not.
- How to assemble paths, parameters or responses. `z.toJSONSchema` converts schemas only; the
  OpenAPI document around them is the caller's job.
