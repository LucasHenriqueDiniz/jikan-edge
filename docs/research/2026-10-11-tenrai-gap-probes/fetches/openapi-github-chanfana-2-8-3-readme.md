---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/cloudflare/chanfana/v2.8.3/README.md
fetched: 2026-10-11
kind: primary
---

# chanfana README at tag v2.8.3 (the last zod v3 release)

> Fetched 2026-10-11 · Read to confirm that the zod v3 line has the same class-based model as 3.x.

## What it says

The key-features list is the same as 3.4.0 minus the zod v4 line:

> "Class-based endpoints"

> "Extend existing Hono, itty-router, etc application, without touching old routes"

The example imports `z` from `'zod'` (v3 at that time) and defines endpoints as `OpenAPIRoute`
subclasses, as in 3.x.

## What it does not say

- A support window for 2.x after 3.0.0 shipped.
