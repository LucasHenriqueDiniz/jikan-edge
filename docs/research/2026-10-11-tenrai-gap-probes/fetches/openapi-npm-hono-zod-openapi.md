---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://registry.npmjs.org/@hono%2Fzod-openapi
fetched: 2026-10-11
kind: primary
---

# @hono/zod-openapi: npm registry document (versions, peers)

> Fetched 2026-10-11 · The registry's packument for Hono's own OpenAPI integration. Read for the
> zod and hono ranges per major and release dates. The packument carries no README for this
> package (the `readme` field is empty), so the README was read from GitHub separately.

## What it says

Extracted from `versions[*]` and `time[*]` (measured, not quoted):

| major | last | released | `peerDependencies.zod` | `peerDependencies.hono` | depends on zod-to-openapi |
| --- | --- | --- | --- | --- | --- |
| 0 | **0.19.10** | 2025-07-13 | `>=3.0.0` | `>=4.3.6` | `^7.3.0` (the zod v3 line) |
| 1 | **1.6.3** | 2026-09-04 | `^4.0.0` | `>=4.10.0` | `^9.1.0` |

1.0.0 was published 2025-07-18. `dist-tags.latest` is 1.6.3. License MIT, nothing deprecated.
1.6.3 also depends on `@hono/zod-validator ^0.9.1` and `openapi3-ts ^4.5.0`.

The repo installs hono 4.13.5 (lockfile), which satisfies both majors' hono range.

## What it does not say

- Whether 0.19.10 still gets fixes. Its peer range `>=3.0.0` looks permissive, but it is pinned to
  zod-to-openapi 7.x, whose maintainers say the line is not actively supported
  (`openapi-npm-zod-to-openapi.md`).
- How much a migration from `app.get` to `app.openapi` costs; that is in the README
  (`openapi-github-hono-zod-openapi-readme.md`).
