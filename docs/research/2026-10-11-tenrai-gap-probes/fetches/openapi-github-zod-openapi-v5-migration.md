---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/samchungy/zod-openapi/master/docs/v5.md
fetched: 2026-10-11
kind: primary
---

# zod-openapi v5 migration guide

> Fetched 2026-10-11 · Read to settle whether zod-openapi 5.x (peer `^3.25.74 || ^4.0.0`) accepts
> the v3 schemas this repo has today.

## What it says

> "Removed: `extendZodWithOpenApi(z)` and `import zod-openapi/extend`"

Under "New requirements":

> "Zod v4 (3.25.74) required"

with the accompanying diff replacing `import { z } from 'zod';` by `import * as z from 'zod/v4';`.

> "You can now declare `zod-openapi` as a dev dependency if you create your schemas at build time."

## What it does not say

- Nothing that would let 5.x read zod v3 schemas: the requirement is the v4 API, reachable through
  the `zod/v4` subpath of a 3.25.x install. So with this repo's zod 3.25.76, zod-openapi 5.x needs
  every parser's import switched to `zod/v4` first (measured: 46 files, see the report).
