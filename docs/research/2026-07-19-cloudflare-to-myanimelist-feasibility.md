---
tags:
  - research
  - cloudflare
  - workers
  - scraping
  - feasibility
status: draft
research_date: 2026-07-19
---

# Research — Feasibility of Cloudflare-to-MyAnimeList ingestion

## Decision question

**Which probe results make Worker ingestion viable?**

## Executive summary

- **Short answer:** Cloudflare Workers has external `fetch()` and enough resources for a controlled probe, but there is no primary evidence that MyAnimeList specifically allows or blocks requests originating from Workers.
- **Direct impact on the project:** viability cannot be decided in a lab, nor inferred from Jikan working on other infrastructure. It is necessary to measure real responses, semantic content, rate limiting and the parser's CPU in a deployed Worker.
- **Recommendation:** **conditional**. Run the probe only after the terms are approved. Accept HTML as a source only if the seven-day test and the target-load test pass with no persistent block, challenge content or CPU overrun.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | Workers Free allows 100,000 requests per day, 10 ms of CPU per invocation, 128 MB of memory, 50 external subrequests, 1,000 subrequests to Cloudflare services and 6 simultaneous external connections. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | Time spent waiting on the network, including `fetch()`, does not count as CPU; parsing, transformation and serialization do. | [Workers limits — CPU time](https://developers.cloudflare.com/workers/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | The runtime provides the Fetch API for external HTTP requests. Redirects also consume subrequests. | [Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | Cloudflare operates an anycast network and shared ranges for its services; the public documentation consulted does not offer an exclusive, stable egress IP for an ordinary Free Worker. | [Cloudflare IP addresses](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/), consulted 2026-07-19. | Medium-high |
| Verified fact | Jikan's documentation acknowledges that calls to MyAnimeList may be rate limited and that its tests can fail with HTTP 429. That demonstrates general upstream risk, not specific behavior against Workers. | [Jikan REST](https://github.com/jikan-me/jikan-rest), consulted 2026-07-19. | High |
| Verified fact | No primary source was found stating that MyAnimeList accepts, blocks or specially handles Cloudflare Workers traffic. | Research carried out 2026-07-19. | High as to the absence of evidence found |
| Inference | Even an HTTP 200 does not prove a successful collection: challenge, consent or error pages can be returned with a 200 status. | Common web-protection practice; needs testing against MAL. | High |
| Inference | The main technical risk on Free is the parser's CPU, not the fetch wait. | Derives from the exclusion of network time and the 10 ms limit. | High |
| Hypothesis to validate | A streaming, selective parser can process the core pages below 10 ms. | The project has no practical measurement. | Low until benchmarked |
| Hypothesis to validate | MAL may apply policies per IP, ASN, region, frequency, headers or shared reputation. | An operational possibility; none confirmed for Workers. | Low/medium |

## Architectural implications

### 1. The probe needs to validate transport and content

Recording only the HTTP status is insufficient. Each sample must measure:

- the requested URL and the final URL;
- the number of redirects;
- the status;
- the `Content-Type`;
- compressed and uncompressed size, where available;
- network duration;
- the parser's CPU;
- the Cloudflare colo/region;
- the page title;
- the required markers;
- block markers;
- a structural hash;
- the extracted fields;
- rate-limit headers or `Retry-After`;
- the network error code;
- the parser version.

### 2. Semantic validation must precede persistence

A response will only be considered valid when it:

- has the expected content type;
- contains at least two or three independent markers for the entity;
- produces an ID and title consistent with the URL;
- contains no known challenge, forced-login or error text/elements;
- respects a plausible size range;
- passes contract validation;
- does not abruptly reduce the required fields relative to the last valid document.

A suspicious response must never replace already-stored valid data.

### 3. The probe must not discover arbitrary URLs

Use a fixed list of representative canaries:

- an old, stable anime;
- a currently airing anime;
- an anime without an English title;
- an anime with many characters;
- a manga in publication;
- a character;
- a person;
- the current season;
- a ranking;
- a known 404 page.

That reduces risk, makes the results comparable and avoids indiscriminate crawling.

### 4. Backoff is part of the viability criteria

Recommended behavior:

- respect `Retry-After`;
- stop a class of requests immediately after a persistent 403/429;
- use exponential backoff with jitter;
- do not change the User-Agent or region to work around a block;
- limit retries;
- serve stale during unavailability;
- keep a circuit breaker per host/resource.

### 5. Worker ingestion must be decoupled from the user's request

Even if the probe passes:

- user requests must not wait on scraping;
- fresh or stale data must be served locally;
- a miss must become a job subject to budget and priority;
- unknown objects must not cause a fan-out;
- an upstream failure must not degrade the local endpoint into a retry storm.

## Risks and limits

### No authorization

The technical probe should only happen after the sources-and-terms decision. Measuring access is not the same as obtaining permission.

### Shared infrastructure reputation

There is no documentation guaranteeing an exclusive egress identity on Free. If upstream applies reputation to shared ranges, the project can suffer interference from traffic it does not control. That is a risk, not a confirmed fact.

### Variation by colo/region

Workers may execute near the user or according to the platform's decisions. Responses may vary by:

- country;
- language;
- consent;
- edge/upstream;
- network route;
- anti-bot policies.

The probe must record the colo, but must not presume it will be able to pin it.

### CPU limit

10 ms is rigid for Free requests. A parser may pass on small pages and fail on pages with:

- many characters;
- larger scripts/ads;
- exceptional content;
- heavy normalization;
- large JSON.

The measurement needs to use p95/p99, not just the mean.

### Headers and identity

Do not use false headers to simulate a real browser or hide the client's nature. The project must use honest identification, a contact and a version, if the terms permit automation. Do not depend on personal cookies.

### False positives of validity

A partially changed layout can pass simple markers and produce incomplete JSON. Validation must consider:

- a minimum number of fields;
- cross-consistency;
- the delta relative to the last version;
- a structural hash;
- parser coverage.

### Queue retention

Free Queues retain messages for only 24 hours. A long upstream outage can expire the backlog; the refresh state needs to exist outside the queue. The queue cannot be the source of truth.

## Questions still open

- Does MAL resolve and respond for Workers in every relevant colo?
- Is there a difference between the HTML delivered to a Worker and to a browser?
- Which minimum headers are required?
- Does upstream provide useful `ETag`, `Last-Modified` or `Retry-After`?
- Which pages depend on JavaScript?
- What is the p95/p99 page size?
- Which parser and field set fit in 10 ms?
- Are there 403/429s by frequency, region, ASN or URL pattern?
- Does the content change by language/region?
- Is there an official contact for identifying the crawler?
- What frequency do the terms authorize?
- Should an official Client ID replace HTML for part of the probe?

## Recommendation and go/no-go criteria

### Recommendation

**Conditional on authorization and the probe.**

### Experiment design

#### Phase A — low-frequency baseline

- duration: 7 days;
- set: 10 to 20 fixed canaries;
- frequency: low and constant, below any planned load;
- no immediate retries;
- record status, semantic validity, latency, CPU and colo;
- store no catalog, only the probe's evidence.

#### Phase B — parser

- at least 50 real pages per core class;
- include small, medium and extreme cases;
- measure CPU p50, p95 and p99;
- compare minimal parsing against the complete document;
- do not extrapolate from a local run to Workers.

#### Phase C — target cadence

- reproduce only the highest cadence the MVP actually intends to use;
- increase gradually;
- stop at the first persistent 403/429/challenge pattern;
- prove recovery after backoff;
- avoid any attempt to work around protection.

### Go criteria

The values below are **project thresholds**, not vendor guarantees:

- documentary authorization concluded;
- at least 99% of the baseline responses semantically valid;
- no challenge/CAPTCHA interpreted as an entity;
- 403/429 below 0.5% and always recoverable with backoff;
- no continuous 30-minute period with more than 5% blocking;
- p95 CPU of the main parser below 8 ms;
- p99 below 10 ms, or the parser split into smaller resources;
- p95 fetch below 5 seconds;
- validation prevents overwriting with an empty/suspicious response;
- stale is served during failures;
- the target cadence passes at least 72 hours with no rising trend in blocking.

### No-go criteria

- the terms do not authorize the automation;
- persistent blocking or a challenge;
- a need for personal cookies, login or a bypass;
- p95 CPU greater than or equal to 10 ms;
- responses vary in an undetectable way;
- a useful cadence requires aggressive retries;
- no alternative source exists for critical data;
- the system only works by imitating a browser's fingerprint.

### A possible outcome: a partial go

It may be viable to collect:

- basic details;
- seasons;
- rankings;

and unviable to collect:

- extensive character lists;
- reviews;
- community pages.

The decision must be per resource, not binary across the whole domain.

## Sources

- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Cloudflare IP addresses](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/)
- [Cloudflare Queues — limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare Queues — pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Workers — errors](https://developers.cloudflare.com/workers/observability/errors/)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [MyAnimeList Terms of Use](https://myanimelist.net/about/terms_of_use)
