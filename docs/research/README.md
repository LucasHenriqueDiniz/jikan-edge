---
tags:
  - research
  - index
  - jikan-edge
status: draft
research_date: 2026-07-19
---

# Research — jikan-edge technical index

## Decision question

**Which decisions need to be resolved, and in what order, before any implementation?**

## Executive summary

- **Short answer:** the project still has two absolute blockers: sustainable authorization of the source, and the real feasibility of access/parsing by Workers.
- **Direct impact on the project:** storage and search have plausible paths, but they do not justify code before origin, terms and a probe are resolved.
- **Recommendation:** **block implementation** until research items 1 and 2 are concluded. After that, run the bootstrap, search, compatibility and traffic benchmarks in the order below.

## Verified evidence

This index references the six documents produced on 19 July 2026. Each document separates facts, inferences and hypotheses, and records primary sources or the limitations where those were unavailable.

## Documents

| Order | Document | Decision question | Status | Depends on |
|---:|---|---|---|---|
| 1 | [MyAnimeList data sources and terms](2026-07-19-myanimelist-data-source-and-terms.md) | Which source can be used sustainably, and under what conditions? | Draft — blocker | None |
| 2 | [Cloudflare → MyAnimeList feasibility](2026-07-19-cloudflare-to-myanimelist-feasibility.md) | Which probe results make Worker ingestion viable? | Draft — blocker | Research 1 |
| 3 | [Catalog bootstrap strategy](2026-07-19-catalog-bootstrap-strategy.md) | How do we start useful coverage without exceeding limits or creating an unviable dependency? | Draft — conditional | Research 1 and 2 |
| 4 | [Multilingual search with D1/FTS5](2026-07-19-d1-search-multilingual.md) | Is D1/FTS5 sufficient for the search and filters MVP? | Draft — benchmark required | Research 3 |
| 5 | [Jikan compatibility and market scope](2026-07-19-jikan-compatibility-market-scope.md) | Should the MVP be a native API or offer selective compatibility from the start? | Draft — consumer research required | Research 1, 3 and 4 |
| 6 | [Traffic and abuse model on Free](2026-07-19-free-tier-traffic-and-abuse-model.md) | Which audience and which rate limit keep the MVP sustainable on Free? | Draft — modeling/benchmark required | Research 2, 3, 4 and 5 |

## Recommended reading order

1. **Sources and terms:** determines whether a sustainable product exists.
2. **Cloudflare → MAL feasibility:** determines whether the permitted ingestion works technically.
3. **Bootstrap:** determines initial coverage without crawling.
4. **D1/FTS5:** determines whether search fits on Free.
5. **Jikan compatibility:** defines the product and the contract once coverage is known.
6. **Traffic and abuse:** sizes the final surface and the public limits.

## Dependencies between research items

```text
Sources and terms
       │
       ├──> Ingestion feasibility
       │          │
       │          └──> Bootstrap
       │                    │
       │                    └──> D1 search
       │                              │
       └──────────────────────────────┴──> Compatibility
                                              │
                                              └──> Traffic and abuse
```

Compatibility depends on real coverage. The traffic model depends on the routes, queries, caching and refresh frequency chosen.

## Architectural implications

Consolidated provisional conclusions:

- an official API or a licensed source must take priority;
- HTML and internal endpoints are not approved by virtue of being publicly accessible;
- R2 is a candidate for canonical documents and static delivery;
- D1 is a candidate for indexes/filters, conditional on a multilingual benchmark;
- the Free Queue limits refreshes to approximately 3,333 normal deliveries/day before retries;
- Workers Free limits us to 100 thousand requests/day;
- caching inside or in front of the Worker must not be confused with traffic outside the Worker;
- R2 objects on a custom domain can take static details out of the Worker's budget;
- the internal model must be native;
- `/v4` compatibility must be selective and tested;
- no public request should trigger synchronous scraping;
- manga coverage will probably start out partial.

## Risks and limits

### Blockers before any code

1. **MyAnimeList's official terms were unavailable during this research.**
   - Obtain and review the text in force.
   - Confirm automation, caching, retention, redistribution and images.
   - Request written authorization if there is ambiguity.

2. **No evidence about Workers → MAL.**
   - Do not claim it either allows or blocks.
   - Probe only after authorization.
   - Measure semantic content, 403/429/challenge and CPU.

3. **MAL's official API quota not confirmed.**
   - Obtain current documentation.
   - Do not plan a bootstrap with an unknown quota.

4. **Rights over images and text.**
   - Separate factual data, synopses, reviews and images.
   - Do not copy images in the MVP without a license.

5. **The bootstrap's license.**
   - Decide whether ODbL is compatible with the project.
   - Evaluate share-alike, attribution and access to the derived database.

6. **Manga coverage.**
   - No equivalent open dataset was identified.
   - Do not promise parity.

7. **Japanese search.**
   - D1/FTS5 is a candidate, not a conclusion.
   - A benchmark is mandatory.

8. **Market/routes.**
   - There is no public per-endpoint telemetry.
   - Analyze active consumers before freezing a `/v4` adapter.

9. **Free capacity.**
   - 100 thousand Worker requests/day is a hard limit.
   - A cache hit via Workers Caching still counts as a request.
   - Rate limiting inside the Worker does not protect that quota.

10. **Degradation and abuse.**
    - Without a tested policy, an enumeration of IDs or unique queries can exhaust the daily quota.

## Questions still open

- Does MyAnimeList authorize the proposed product?
- Does the official API allow retention and redistribution?
- Does MAL respond stably to Workers?
- Does the main parser fit in 10 ms?
- Does the licensed bootstrap cover the hot set?
- Does the anime index fit in 500 MB?
- Is trigram available in D1?
- What is the quality of Japanese search?
- Which routes represent real demand?
- How many requests and rows read does a typical consumer generate?
- What public limit avoids exhaustion?
- When do we migrate from Free to Paid?

## Recommendation and go/no-go criteria

### Overall state

**No-go for implementation at this time.**

### To release a technical spike

- terms review concluded;
- source approved;
- our own Client ID, if applicable;
- probe authorized;
- stopping criteria defined.

### To release the MVP

- probe approved;
- parser within the CPU budget;
- licensed bootstrap;
- search approved by benchmark;
- adapter/routes defined by consumer research;
- traffic below 70% of the quotas;
- degradation and rate limits defined;
- public documentation of coverage and provenance.

## Sources

The complete sources are listed in each document. Central sources:

- [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2)
- [MyAnimeList Terms of Use](https://myanimelist.net/about/terms_of_use)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan REST](https://github.com/jikan-me/jikan-rest)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
