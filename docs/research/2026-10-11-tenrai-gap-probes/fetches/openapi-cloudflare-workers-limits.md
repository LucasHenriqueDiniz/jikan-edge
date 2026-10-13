---
tags: [fetch, 2026-10-11-tenrai-gap-probes]
source: https://developers.cloudflare.com/workers/platform/limits/index.md
fetched: 2026-10-11
kind: vendor
---

# Cloudflare Workers docs: Limits

> Fetched 2026-10-11 · Read to judge two costs: generating the document inside the Worker (CPU per
> request) and growing the bundle with zod 4 or a generator library.

## What it says

The limits table gives CPU time 10 ms on Workers Free and 5 min on Paid, Worker size 64 MiB on both,
and Worker startup time 1 second on both.

> "There is no compressed size limit. Only the uncompressed bundle size counts."

> "Larger Worker bundles can impact startup time."

> "A Worker must parse and execute its global scope (top-level code outside of handlers) within 1 second."

A Worker over the CPU limit gets Error 1102, "Worker exceeded resource limits".

## What it does not say

- The CPU cost of building this API's document in a Worker. Measured as a proxy in Node 24 on the
  development Mac: zod-to-openapi 9.1.0 took 14-15 ms cold and about 5.5 ms warm to build all 98
  paths; native `z.toJSONSchema` about 2 ms warm. A cold build over 10 ms is the same class of risk
  `docs/self-hosting.md` already records for heavy routes on Free (Error 1102). In local workerd the
  first `/openapi.json` request took 28 ms wall; the in-Worker timer read 0 ms, so CPU was not
  measurable there.
