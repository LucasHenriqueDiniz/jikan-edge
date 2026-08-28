---
tags:
  - research
  - jikan
  - myanimelist
  - cloudflare
  - architecture
---

# Research — Jikan and a Cloudflare-native alternative

> Research date: 2026-07-19  
> Status: a basis for decision; not an implemented specification.

## Executive summary

Jikan is an unofficial, read-only API that obtains its data by scraping MyAnimeList. The public documentation states a 24-hour cache and limits of 3 requests/second and 60/minute. That shows caching, frequency control and tolerance for source failures are central properties of the problem — not optional optimizations.

A Cloudflare-native alternative on the Free plan may be viable for a small MVP with controlled traffic, provided it is oriented around stored data, caching and asynchronous updates. There is not enough evidence to promise a complete public replacement for Jikan: Workers Free has 100,000 requests/day and 10 ms of CPU per invocation, and every access to D1/R2/KV counts as a subrequest.

## How Jikan works

Jikan presents itself as an unofficial MyAnimeList API that scrapes the site to fill the gaps in the official API. The public API is GET-only, stores extracted data temporarily for 24 hours and offers `ETag`/`304` for cache validation.

In practice, the service has to separate two responsibilities:

- obtaining and interpreting data from the source, which fails and can be rate limited;
- a queryable catalog/cache, which protects the source and gives consumers predictable performance.

That explains why the historical Jikan REST deployment involves an application, a database, migrations and a scheduler. That stack is a domain reference, but it should not be ported directly to Workers.

## Verified Cloudflare constraints

| Free resource | Relevant limit | Design consequence |
| --- | ---: | --- |
| Workers | 100,000 requests/day | a public API needs rate limiting, CDN caching and a degradation plan |
| CPU per invocation | 10 ms | parsing and normalization can only be accepted after a real benchmark |
| Memory | 128 MB | responses must be processed in a streaming fashion; do not assume a large complete DOM |
| Subrequests | 50/request | every call to the source, R2 or D1 counts against the per-request budget |
| D1 | 5 million reads/day; 100 thousand writes/day; 5 GB total | use it as index and query layer; measure write amplification |
| KV | 1,000 writes/day | do not use it as canonical storage for items updated in volume |
| Queues | 10,000 operations/day, 24 h retention | it serves small, deduplicated updates; each message normally consumes three operations |

Time spent waiting on the network does not count against the Worker's CPU, but parsing, transformation and serialization do. So a `fetch` being possible does not prove the parser fits on Free.

## Candidate architecture

```text
Allowed source
    -> asynchronous, rate-limited ingestion
    -> normalization/versioning
    -> R2: payload per entity
    -> D1: aliases, filters and minimal relations
    -> API Worker + cache: reads, ETag and stale-while-revalidate
```

This is a hypothesis, not a final decision. R2 keeps ID lookups from depending on extensive normalized tables; D1 allows search and filtering that a key-value store does not solve. Both choices depend on the cost and search-quality experiments.

## Sources and scraping: recommended posture

1. Prefer an official API when it offers the required fields and access model.
2. Treat public HTML as a source to be validated: terms, consistency across regions, blocks, alternative content and structural changes.
3. Treat internal endpoints observed on the network as investigation, never as an MVP dependency. They can change, require a session or contradict the terms of use.
4. Do not scrape live to satisfy a user's request. On a cache miss, answer with the known/stale state and request a deduplicated update.
5. Keep canaries, fixtures, schema validation and protection against storing a block page as valid data.

## Recommended initial scope

If the blockers are cleared, the first slice should be limited to anime: detail by ID, title search, genres, current season and ranking. Manga, characters, people, deep relations, reviews, news and a Jikan adapter should stay out until the basic flow has a measured budget.

## Risks that remain open

- An inconsistent response or a block of the source for Cloudflare IPs.
- HTML changes and false success (a CAPTCHA/error page with status 200).
- CPU above 10 ms on large pages or during normalization.
- Poor FTS5 quality for Japanese and aliases.
- Write amplification across titles, genres, relations and indexes.
- Exhausting the request quota even with caching, since the Worker is still invoked.
- Terms-of-use and rights implications for data and images.

## Conclusion

The responsible path is neither to rewrite the whole of Jikan nor to declare v4 compatibility. It is to run a spike that answers, first, whether there is a sustainable source, a parser within the CPU budget, storage within the allowances and acceptable search. Until those results exist, the architecture above is a research direction and not an implementation commitment.

## Sources

- [Jikan API v4 — documentation](https://docs.api.jikan.moe/)
- [Jikan REST — installation and operation](https://github.com/jikan-me/jikan-rest/wiki/Installation-%28feature-elasticsearch%29)
- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — pricing, D1, KV and Queues](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Queues on the Free plan](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)
