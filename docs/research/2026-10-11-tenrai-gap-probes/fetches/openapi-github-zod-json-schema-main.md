---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/json-schema.mdx
fetched: 2026-10-11
kind: primary
---

# Zod docs: JSON Schema, on main (the 4.6.x line)

> Fetched 2026-10-11 · Read to compare with the 3.25.76 page: what an actual upgrade to the `zod@4`
> package adds to native conversion.

## What it says

> "Introduced in `zod@4.0`, Zod supports native JSON Schema conversion."

The target list has grown: `"draft-2020-12"` (default), `"draft-07"`, `"draft-04"`, and

> "`"openapi-3.0"` — OpenAPI 3.0 Schema Object"

On objects:

> "By default, `z.object()` schemas contain `additionalProperties: "false"`."

> "This is an accurate representation of Zod's default behavior, as plain `z.object()` schema strip additional properties."

## What it does not say

- The version that introduced the `openapi-3.0` target (this page is the current docs; the 3.25.76
  page lacks it).
- Anything about paths or documents; it remains a schema converter.
