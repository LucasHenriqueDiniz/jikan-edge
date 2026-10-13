---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://honohub.dev/docs/openapi/zod
fetched: 2026-10-11
kind: vendor
---

# hono-openapi docs: using it with Zod

> Fetched 2026-10-11 · Read to see whether documenting a route needs a rewrite or only an extra
> argument on the existing `app.get`. Read through a summarising fetch tool; quotes are its verbatim
> extracts.

## What it says

`describeRoute(...)` is passed as middleware inside an ordinary `app.get("/", describeRoute({ ... }), handler)`:

> "For describing the response body or adding information about the route, import `describeRoute` from `hono-openapi`."

The document is served by a handler:

> "For serving the OpenAPI spec, you can use the `openAPIRouteHandler` from `hono-openapi`."

> "This will automatically generate the OpenAPI spec based on the routes you have defined in your Hono app."

On zod majors:

> "Zod v4 uses its built-in JSON Schema conversion and does not require `zod-openapi`."

> "Zod v3 requires `zod-openapi@4` for reference support."

## What it does not say

- How to call `generateSpecs` (mentioned only as an options target), i.e. whether a static file can
  be produced in Node without serving it. Not established.
- Whether `describeRoute` entries show up in `app.routes` as extra GET handlers (they would be
  middleware on the same path; this repo's `query-contract.test.ts` deduplicates paths, so it would
  likely still pass). Not tested.
