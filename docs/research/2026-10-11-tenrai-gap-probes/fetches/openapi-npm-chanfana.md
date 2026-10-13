---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://registry.npmjs.org/chanfana
fetched: 2026-10-11
kind: primary
---

# chanfana: npm registry document (versions, dependencies, README of 3.4.0)

> Fetched 2026-10-11 · Cloudflare's OpenAPI library for Workers routers. Read for its zod line per
> major and the README that ships with 3.4.0.

## What it says

Extracted from `versions[*]` and `time[*]` (measured, not quoted). chanfana lists zod as a regular
**dependency**, not a peer, so it installs its own copy:

| major | last | released | `dependencies.zod` | `dependencies['@asteasolutions/zod-to-openapi']` |
| --- | --- | --- | --- | --- |
| 2 | **2.8.3** | 2025-10-07 | `^3.23.8` | `^7.2.0` |
| 3 | **3.4.0** | 2026-08-17 | `^4.4.3` | `^8.5.0` |

3.0.0 was published 2026-01-05. License MIT.

README (3.4.0):

> "Zod v4 compatible with full TypeScript inference"

> "Extend existing Hono, itty-router, etc application, without touching old routes"

> "CLI to extract the schema.json from your code (npx chanfana)"

The Hono example defines each endpoint as a class:

> "export class GetPageNumber extends OpenAPIRoute {"

and registers it through a wrapper around the app: `const openapi = fromHono(app)` then
`openapi.get('/entry/:id', GetPageNumber)`.

> "chanfana is considered stable and production ready and is being used with the Radar 2.0 public API"

## What it does not say

- That "without touching old routes" means the old routes stay **undocumented**; that is stated in
  the router-adapters page (`openapi-github-chanfana-router-adapters.md`).
- Whether the bundled zod 4 copy could validate this repo's zod 3 schemas. It cannot by
  construction: a zod 3 `ZodType` is not a zod 4 one (`openapi-github-zod-versioning.md`).
