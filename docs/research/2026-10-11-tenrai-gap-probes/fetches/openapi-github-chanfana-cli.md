---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/cli.md
fetched: 2026-10-11
kind: primary
---

# chanfana docs: Command Line Interface (main)

> Fetched 2026-10-11 · Read to see whether chanfana can produce a static file at build time or only
> serve the document at runtime.

## What it says

> "The `npx chanfana` command starts a local development server using `npx wrangler dev`, captures the server URL, fetches the OpenAPI schema from the `/openapi.json` endpoint"

> "If the schema fetch fails or the server doesn't start within 60 seconds, buffered output and error details are logged."

So the static file is extracted from a running Worker: the document is always produced at runtime
by the Worker's own `/openapi.json` route, and the CLI just captures it.

## What it does not say

- How it behaves with a `wrangler.jsonc` (the notes mention `wrangler.toml`), or in CI without
  Cloudflare credentials when the config declares D1 and rate-limit bindings. Not tested.
