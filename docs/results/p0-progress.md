# P0 — hardening progress

Date: 2026-07-19.

> **Later correction (2026-07-30).** The conclusion about lists recorded below was wrong and turned into a production bug: the 273 links were the **truncated** list (the profile declares 360), `offset` does exist and works as a query param, and the generalization of "the whole snapshot in one fetch" came from a single profile that happened to use the classic layout. The correct state is in [`docs/sources/mal-list-delivery.md`](../sources/mal-list-delivery.md). The original text follows below as a record of what was known on that date.

## Done in this stage

- `AMayacrab`'s public list inspected directly: anime returned 273 links in 595,422 bytes; manga, 227 links in 509,234 bytes. Neither HTML contained `offset`, `page`, `ajax` or `xhr`. For that user, the list is a whole snapshot in one fetch per medium.
- The list parser already refuses duplicate IDs and items that fail validation, preserving the previous D1 snapshot.
- The MAL client uses manual redirects, at most three, and validates HTTPS and the exact host at every hop. An external redirect is rejected.
- The User-Agent now references the real endpoint, with no `replace-me`.
- Native Rate Limiting API: 60 requests/60 s per IP and route. It is colo-local and permissive/eventually consistent, as Cloudflare's API states; it protects upstream but does not serve as global accounting.
- A JSON `operation_metric` is emitted per request, including route, status, duration and limiting outcome.
- Worker published as version `6f4f4942-a00a-4e09-84e7-d03705afbab4`.

## Still pending in P0

- An integration harness with D1 that proves fresh/stale cache, an unavailable source, a suspicious response and concurrent/abandoned leases.
- A reliable sample of small/medium/very large users: two further attempts at public users returned documents with no cards, possibly a block or source state, and should not be treated as a benchmark.
- A conclusive investigation of 1042/404. The official documentation defines 1042 as a Worker-to-Worker fetch within the same zone without `global_fetch_strictly_public`; the Worker does not fetch its own zone. The observed occurrence falls outside the code and requires Cloudflare traces/logs for correlation.

## Validation

`typecheck`, 11 tests, a dry run, the local migration and the benchmark all completed successfully. The benchmark is still only a parser microbenchmark.

## Sources

- [Cloudflare Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare error 1042](https://developers.cloudflare.com/workers/observability/errors/)
