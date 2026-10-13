---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://registry.npmjs.org/zod-openapi
fetched: 2026-10-11
kind: primary
---

# zod-openapi (samchungy): npm registry document (versions, peers, README of 6.0.2)

> Fetched 2026-10-11 · Read for the zod range per major and for how the latest README says
> documents are built.

## What it says

Extracted from `versions[*]` and `time[*]` (measured, not quoted):

| major | first | last | released | `peerDependencies.zod` |
| --- | --- | --- | --- | --- |
| 4 | 4.0.0 (2024-11-10) | **4.2.4** | 2025-03-29 | `^3.21.4` |
| 5 | 5.0.0 (2025-07-05) | 5.4.6 | 2026-01-05 | `^3.25.74 \|\| ^4.0.0` |
| 6 | 6.0.0 (2026-06-14) | **6.0.2** | 2026-08-31 | `^4.0.0` |

License MIT.

README (6.0.2). Metadata goes through zod's own `.meta()`:

> "This library leverages Zod's built-in metadata functionality - no monkey patching or additional setup is required."

The document is built by one function, `createDocument({ openapi, info, paths })`, where each path
item carries `requestParams` and `responses` with zod schemas (code sample).

> "Currently the following versions of OpenAPI are supported"

followed by `3.1.0` "(minimum version)" and `3.1.1`.

## What it does not say

- That the 5.x peer range `^3.25.74` means zod **v4 schemas** imported from `zod/v4` inside a 3.25
  package, not the v3 schemas the root `zod` export gives. That is in the v5 migration guide
  (`openapi-github-zod-openapi-v5-migration.md`).
- Anything about Workers. `createDocument` is a pure function; it was run in Node for the
  measurement, not inside workerd.
