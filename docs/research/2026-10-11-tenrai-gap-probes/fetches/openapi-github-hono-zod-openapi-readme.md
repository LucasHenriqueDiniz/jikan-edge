---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/honojs/middleware/main/packages/zod-openapi/README.md
fetched: 2026-10-11
kind: primary
---

# Zod OpenAPI Hono: README on main (the 1.6.x line)

> Fetched 2026-10-11 · Hono's own OpenAPI package. Read to settle whether documenting a route
> requires changing how the route is defined, which matters for a repo with ~98 `app.get` calls.

## What it says

It is a subclass of Hono, built on zod-to-openapi:

> "**Zod OpenAPI Hono** is an extended Hono class that supports OpenAPI."

The `z` object comes from this package rather than from `zod`:

> "The `z` object should be imported from `@hono/zod-openapi`"

A documented route is a `createRoute({...})` object registered with `app.openapi(route, handler)`
on an `OpenAPIHono` instance (code samples), and the document is served by a route:

> "The OpenAPI documentation will be available at /doc"

There is also an in-process method, `app.getOpenAPI31Document(config, generatorOptions)`, and the
underlying registry is exposed:

> "You can access the [`OpenAPIRegistry`] object via `app.openAPIRegistry`"

Limitations, on mixing with plain Hono:

> "plain `Hono` knows nothing about the OpenAPI spec additions"

> "If you're migrating from plain `Hono` to `OpenAPIHono`, we recommend porting your top-level app, then working your way down the router tree."

## What it does not say

- Any way to document an existing `app.get(...)` route without rewriting it as `createRoute` +
  `app.openapi`. The only route-level path to the document is the rewrite (or calling
  `openAPIRegistry.registerPath` by hand, which is just zod-to-openapi used directly).
- How its request validation would coexist with this repo's own `QUERY_CONTRACT` guard and its
  `UNKNOWN_PARAMETER` / `UNSUPPORTED_PARAMETER` codes.
