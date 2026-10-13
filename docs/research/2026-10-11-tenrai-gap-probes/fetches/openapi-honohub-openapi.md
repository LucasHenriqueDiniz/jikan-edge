---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://honohub.dev/docs/openapi
fetched: 2026-10-11
kind: vendor
---

# hono-openapi docs: overview and installation

> Fetched 2026-10-11 · The documentation site hono-openapi's README points to. Read for which zod
> versions need extra packages. Read through a summarising fetch tool, so the quotes below are the
> tool's verbatim extracts, not a raw copy of the page.

## What it says

> "hono-openapi is a library that makes it easy to generate OpenAPI specifications for your Honojs app."

> "Few validation libraries require additional dependencies to work with `hono-openapi`."

The installation table lists, for Zod v4, "No additional package required", and for Zod v3,
`zod-openapi@4`.

## What it does not say

- How a route is described, or whether the document can be produced outside a running app (see the
  zod page, `openapi-honohub-openapi-zod.md`).
- Which zod 3 minor `zod-openapi@4` needs (the registry says `^3.21.4`, so 3.25.76 satisfies it).
