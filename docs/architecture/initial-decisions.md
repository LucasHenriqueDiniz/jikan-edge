# Initial architecture decisions

> Status: initial proposals — not implemented.
>
> **Partly superseded, 2026-09-02.** Item 2 of "Accepted principles" below names R2 as a candidate
> for the canonical document, and the diagram under "Conceptual design to test" draws
> `R2 (payload) + D1 (index)`. Neither holds: the `SNAPSHOTS_BUCKET` binding was removed on
> 2026-07-30 and D1 is the only storage. What actually shipped is recorded in
> [`../architecture.md`](../architecture.md) and in [`ARCHITECTURE.md`](ARCHITECTURE.md) (decision
> D2). Everything else here stayed a proposal or was decided elsewhere — read it as the record of
> what was considered, not as the current design.

## Product direction

Build a read API for an anime/manga catalog inspired by what makes Jikan useful: normalized, cacheable data that is accessible without every consumer having to deal with external sources.

The product does not start with a promise to replace the whole Jikan v4 API, nor with payload parity.

## Accepted principles

1. **Cache and pre-collected data first.** A user read must prioritize stored, possibly stale data; it must not depend on synchronous scraping.
2. **Separate payload from index.** R2 is a candidate for the canonical document and D1 for the index, relations and querying. This needs a benchmark before it becomes a final decision.
3. **Decoupled ingestion.** Updates are candidates for asynchronous jobs, with deduplication, limits and backoff.
4. **A native API before compatibility.** The MVP must have its own `/v1`. A Jikan compatibility adapter will only be evaluated once the internal contracts are stable.
5. **Free as a design constraint, not a scale guarantee.** The architecture must degrade with stale data and explicit limits, rather than hiding unpredictable consumption.
6. **A lawful, sustainable source.** Official APIs are preferred. Any use of public HTML or an internal endpoint requires validating the terms, the real behavior and a plan for changes.

## Source decision for the discovery phase

For the current phase, the project will **not use MyAnimeList's official API**. The source hypothesis is scraping MyAnimeList's public HTML pages, along the general lines of Jikan.

Limits of this decision:

- no login, user cookies, tokens, private data or mutations;
- no CAPTCHA, block bypassing, deceptive fingerprinting or attempts to circumvent protections;
- internal endpoints observed in the Network tab stay off the initial path;
- scraping may only happen asynchronously, rate-limited, cached and with backoff;
- an unexpected page, a challenge, an error or incomplete content never replaces valid data.

This removes the official API from the architecture scope, but it does not remove the need to record the terms in force, respect the source's limits and stop collecting if the probe identifies a persistent block.

## Conceptual design to test

```text
Authorized source / validated HTML
              |
              v
Async ingestion -> normalization -> R2 (payload) + D1 (index)
                                      |
                                      v
Client -> API Worker -> cache/CDN -> fresh or stale response
```

## Out of the proposed MVP

- Writing to user lists or authenticating on behalf of users.
- Copying/proxying images.
- Full coverage of the Jikan v4 endpoints.
- Depending on an automated browser in the normal ingestion path.
- Importing the entire catalog before measuring size and cost.

## Pending decisions that block code

- Whether MyAnimeList's public HTML is operationally stable for the proposed collection pattern.
- Which entities and fields go into the MVP.
- Whether a Free Worker supports the minimal parser with CPU headroom.
- Whether D1/FTS5 handles search in English, romaji and Japanese.
- How to serve and signal stale data.
- What level of Jikan compatibility, if any, will be promised.
