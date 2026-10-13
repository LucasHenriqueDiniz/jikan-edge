---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/router-adapters.md
fetched: 2026-10-11
kind: primary
---

# chanfana docs: Router Adapters (main)

> Fetched 2026-10-11 · Read to find out what "without touching old routes" means in practice:
> whether plain `app.get` routes end up in the generated document.

## What it says

Section "Extending Existing Hono Applications":

> "You can gradually add OpenAPI documentation and validation to your existing routes by converting your route handlers to `OpenAPIRoute` classes"

On the example with one legacy `app.get` route and one chanfana route:

> "Only the `/new-route` will have OpenAPI documentation and validation."

## What it does not say

- Any way to attach a response schema to a plain Hono handler. Documentation is per converted
  class; for this repo that is all ~98 handlers.
