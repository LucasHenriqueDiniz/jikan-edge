---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://registry.npmjs.org/@asteasolutions%2Fzod-to-openapi
fetched: 2026-10-11
kind: primary
---

# @asteasolutions/zod-to-openapi: npm registry document (versions, peers, README of 9.1.0)

> Fetched 2026-10-11 · The registry's packument for the library every zod-based OpenAPI generator
> here builds on. Read for which major supports which zod, release dates, and the README that ships
> with the latest version (9.1.0).

## What it says

Release metadata, extracted from `versions[*].peerDependencies` and `time[*]` (measured, not quoted):

| major | first | last | last released | `peerDependencies.zod` | license |
| --- | --- | --- | --- | --- | --- |
| 7 | 7.0.0 (2024-04-05) | **7.3.4** | 2025-06-13 | `^3.20.2` | MIT |
| 8 | 8.0.0 (2025-07-15) | 8.5.0 | 2026-03-20 | `^4.0.0` | MIT |
| 9 | 9.0.0 (2026-07-14) | **9.1.0** | 2026-07-19 | `^4.0.0` | MIT |

`dist-tags.latest` is 9.1.0; no version is marked deprecated. 9.1.0 depends on `openapi3-ts ^4.6.0`.

README (9.1.0), the version note at the top:

> "For Zod v3 support, please use the v7.3.4 version."

> "we do not intend to actively support that version going forward"

On generators:

> "There are three generators that can be used - `OpenApiGeneratorV3`, `OpenApiGeneratorV31` and `OpenApiGeneratorV32`."

On paths, which are registered on a registry, not on a router:

> "An OpenAPI path is registered using the `registerPath` method of an `OpenAPIRegistry` instance."

On build-time use (section "Adding it as part of your build"):

> "This script can be executed as a part of your build step so that it can write the result to some file like `openapi-docs.json`."

On objects:

> "by default a Zod object will result in `"additionalProperties": true` as per the Open API spec unless using `strict` or `catchall`"

On metadata from v8:

> "Starting from v8 (and zod v4) you can also use zod's .meta to provide metadata"

Unsupported types:

> "you'd receive an `UnknownZodTypeError`."

## What it does not say

- Whether 7.3.4 works with the zod **3.25.x** package specifically (it does in practice: see the
  measured run in the report — 98 paths generated from this repo's schemas with zod 3.25.76).
- Anything about Cloudflare Workers. The library is plain TypeScript with one dependency
  (`openapi3-ts`); running it inside workerd was measured separately, not stated here.
- Whether the output changes between 7.x and 9.x for the same schemas. Measured: for this repo's
  schema set the two documents were byte-identical.
