---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/honojs/middleware/%40hono/zod-openapi%400.19.10/packages/zod-openapi/README.md
fetched: 2026-10-11
kind: primary
---

# Zod OpenAPI Hono: README at tag @hono/zod-openapi@0.19.10 (the last zod v3 release)

> Fetched 2026-10-11 · Read to confirm the zod v3 line has the same route-definition model as the
> current one, since 0.19.10 is the version this repo could install without upgrading zod.

## What it says

Same model as 1.6.x. The schema setup section:

> "The `z` object should be imported from `@hono/zod-openapi`"

and the code samples define routes with `createRoute({ ... })`, create `new OpenAPIHono()`, and
register handlers with `app.openapi(route, (c) => { ... })`.

## What it does not say

- Anything about zod 3.25's `zod/v4` subpath or the move to zod 4 (that is the 1.0.0 changelog
  entry, `openapi-github-hono-zod-openapi-changelog.md`).
