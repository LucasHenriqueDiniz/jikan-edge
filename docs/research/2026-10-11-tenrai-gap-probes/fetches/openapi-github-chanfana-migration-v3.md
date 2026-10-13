---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://raw.githubusercontent.com/cloudflare/chanfana/main/docs/migration-to-chanfana-3.md
fetched: 2026-10-11
kind: primary
---

# chanfana docs: Migration Guide v2 to v3 (Zod v4)

> Fetched 2026-10-11 · Read to confirm which zod each chanfana major is built on.

## What it says

> "This guide helps you migrate from chanfana v2 (Zod v3) to chanfana v3 (Zod v4)."

> "Chanfana v3 has been updated to use Zod v4 and `@asteasolutions/zod-to-openapi` v8."

The first breaking change listed is zod 4's new validation error messages (for example `"Required"`
becoming `"Invalid input: expected <type>, received undefined"`).

## What it does not say

- Anything relevant to response documentation specifically; the guide is about request validation
  and error formats. This repo surfaces no zod error message to callers (parsers only read
  `safeParse(...).success`), so the message changes would not reach the API.
