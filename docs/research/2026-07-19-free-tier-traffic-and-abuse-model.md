---
tags:
  - research
  - cloudflare
  - free-tier
  - traffic
  - abuse
  - rate-limiting
status: draft
research_date: 2026-07-19
---

# Research — Traffic and abuse model on the Free plan

## Decision question

**Which audience and which rate limit keep the MVP sustainable on Free?**

## Executive summary

- **Short answer:** Free supports a public preview and personal/small projects, not an unrestricted replacement for Jikan's scale. The most immediate limit is 100,000 Worker requests per day.
- **Direct impact on the project:** caching does not automatically eliminate the quota. The Cache API and origin cache behind the Worker still start with an invocation; Workers Caching can avoid execution, but cached requests still count as Worker requests. Public objects in R2 on a custom domain can be served without a Worker.
- **Recommendation:** **conditional** on a controlled beta: static payloads via R2/CDN, dynamic search with a free API key, pre-Worker rate limiting via WAF and additional limits inside the Worker. No SLA and no synchronous refresh.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | Workers Free allows 100,000 requests/day and returns Error 1027 when the limit is exceeded. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | Fail-open mode may bypass the Worker once the quota is exceeded; fail-closed returns an error. For an API and security controls, fail-closed is the safe behavior. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | The Cache API (`caches.default`) operates inside the Worker; therefore the request has already invoked the Worker. | [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), consulted 2026-07-19. | High |
| Verified fact | In the traditional Worker + zone cache flow, the Worker runs before the origin cache is checked. | [Workers and Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/), consulted 2026-07-19. | High |
| Verified fact | Workers Caching can respond before the Worker's code runs, but the pricing documentation states that those responses count toward the same request metric. | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Workers cache configuration](https://developers.cloudflare.com/workers/cache/configuration/), consulted 2026-07-19. | High |
| Verified fact | R2 Free includes 10 GB-month, 1 million Class A and 10 million Class B operations/month, with free egress. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), consulted 2026-07-19. | High |
| Verified fact | An R2 bucket on a custom domain can use the CDN, WAF and cache. JSON is not cached automatically in every case and needs an appropriate rule. The `r2.dev` domain does not offer those controls. | [R2 cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/) and [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), consulted 2026-07-19. | High |
| Verified fact | Caching on an R2 domain relaxes consistency: an overwrite/delete may keep serving the previous object until the TTL/purge; a 404 can also be cached. | [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), consulted 2026-07-19. | High |
| Verified fact | D1 Free: 5 million rows read/day, 100 thousand rows written/day, 5 GB total, 500 MB per database. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | Queues Free includes 10,000 operations/day; a normal message under 64 KB usually consumes three operations: write, read and delete. Free retention is 24 hours. | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) and [limits](https://developers.cloudflare.com/queues/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | WAF Free allows one rate limiting rule, with matching restricted mainly to path/verified bot, counting per IP, a 10-second period and no cache exclusion. | [WAF rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/), consulted 2026-07-19. | High |
| Verified fact | The Rate Limiting binding inside the Worker is local per colo, permissive/eventually consistent and runs after the Worker has already started. It is not an exact accounting system. | [Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), consulted 2026-07-19. | High |
| Inference | Open CORS makes browser use easier, but it does not protect against bots or server-side clients. | CORS semantics. | High |
| Inference | A free API key improves identification and quotas, but it does not protect anonymous requests before invocation if verification happens only inside the Worker. | Derived from the lifecycle. | High |
| Inference | Sequential IDs are only cheap if the object exists and is served directly from cache/R2. Misses that enqueue a refresh can turn enumeration into a cost attack. | Derived from the architecture. | High |

## Architectural implications

### 1. Separate static and dynamic traffic

#### The object domain

- documents by ID;
- immutable/versioned payloads;
- an R2 custom domain;
- a Cache Rule for JSON;
- a high TTL;
- no Worker on the normal path.

Benefit: a cache hit consumes neither a Worker invocation nor an R2 operation.

#### The dynamic API domain

- search;
- filters;
- pagination;
- aliases;
- compatibility;
- metadata;
- it uses Worker + D1.

### 2. The cache key must be canonical

To avoid infinite cardinality:

- allow only documented parameters;
- strip empty/unknown parameters;
- normalize case where semantically permitted;
- sort query parameters;
- limit the size;
- limit `page`/`limit`;
- do not vary by irrelevant headers;
- do not accept cache-busting;
- separate version and format.

### 3. Recommended audience

The Free phase:

- a preview for developers;
- personal projects;
- demos;
- small bots/sites;
- no SLA guarantee;
- no critical dependency;
- access revocable/reducible on abuse.

Not recommended:

- apps with tens of thousands of active users;
- mass sync;
- crawling;
- dataset training;
- mirrors;
- use as the sole production backend at high scale.

### 4. Rate limit model

#### Layer 1 — WAF before the Worker

Use the single Free rule to limit dynamic paths. Since the Free window is short and counting is per IP, it is coarse protection, not a product quota.

#### Layer 2 — a key inside the Worker

- a free API key for search and filters;
- a key per consumer/route;
- a local rate binding;
- different limits by cost;
- do not use IP alone, since NAT/proxies aggregate users;
- accept that this is not exact global accounting.

#### Layer 3 — an operational budget

- a global daily refresh limit;
- no public request forces a refresh;
- job admission by priority;
- disable backfill as the quotas are approached.

### 5. ID enumeration

Measures:

- do not fetch upstream synchronously;
- do not automatically enqueue any arbitrary ID;
- accept a miss only for IDs known to the catalog;
- a negative cache for 404;
- a TTL for 404;
- limit the frequency of misses per client;
- detect sequences at the observability level;
- keep a bulk endpoint out of the MVP;
- prevent a public `refresh=true`.

### 6. Cache stampede

Requirements:

- a single refresh per entity/resource;
- a lock/idempotency outside the Queue;
- an immediate stale response;
- a cooldown after an error;
- limited fan-out;
- the Queue is not the source of truth.

## Risks and limits

### Workers Caching does not solve the daily quota

Even when it avoids running the code, the pricing documentation counts cached requests. Therefore:

- 100 thousand requests/day remains the ceiling;
- the CDN going straight to R2 is necessary to divert static traffic;
- do not base capacity on "90% cache hit = 90% fewer Worker requests".

### WAF Free is limited

A single rule and a 10-second window do not offer:

- a daily quota per key;
- cost per endpoint;
- exact global protection;
- enumeration detection;
- cache exclusion;
- custom counting.

### The rate limit inside the Worker arrives too late

It reduces D1/R2/upstream use, but it does not avoid consuming the very invocation it is protecting. Under a volumetric attack, the 100 thousand quota can still run out.

### A public R2

Making a bucket public requires:

- objects with no secrets;
- keys that do not enumerate private data;
- a carefully configured 404 cache;
- purge/versioned objects;
- a WAF against abuse;
- deliberate CORS.

### D1 rows read

The limit may run out before the requests do. An example model:

- 50 thousand dynamic requests/day;
- 100 rows read per request;
- 5 million rows read/day.

So the p95 budget of rows per query is critical.

### Queues

10 thousand operations/day corresponds to approximately 3,333 normal deliveries with no retries. Retries and dead-letter consume more. That limits on-demand refresh.

## Traffic scenarios

The scenarios are models, not forecasts.

| Scenario | Dynamic requests/day | Average rows read | D1 rows/day | Refreshes/day | Interpretation |
|---|---:|---:|---:|---:|---|
| Low | 5,000 | 50 | 250,000 | 200 | Comfortable |
| Moderate | 30,000 | 100 | 3,000,000 | 1,000 | Viable with headroom |
| At the limit | 50,000 | 100 | 5,000,000 | 2,000 | D1 with no headroom |
| Worker saturated | 100,000 | 20 | 2,000,000 | 0 | Worker quota exhausted |
| Miss abuse | 20,000 | 20 | 400,000 | up to 20,000 attempts | Queue/ingestion unviable without admission |
| Static direct | 500,000 on the CDN | 0 | 0 | 0 | Viable if served from the R2 cache with no Worker; the origin depends on the hit ratio |

## Questions still open

- Is Workers Caching available and stable for the account's final design?
- What is the real cache hit ratio of the R2 objects?
- How much traffic comes from detail versus search?
- What is p95 rows read per route?
- How many refreshes are really needed per day?
- Will an API key be mandatory for search?
- How do we issue keys without creating a heavy administrative service?
- Which rate limit keeps the UX good?
- Can WAF Free cover every dynamic path with one expression?
- What CORS policy applies?
- Which 404 TTL avoids hiding new objects?
- How do we publicize degradation and quota?
- Is a minimum paid plan needed before the open beta?

## Recommendation and go/no-go criteria

### Recommendation

**A controlled beta on Free.**

Audience:

- developers and small projects;
- public static detail;
- dynamic search with a free key;
- no bulk;
- no force refresh;
- no SLA.

The initial proposed rate limit, subject to testing:

- detail in R2/CDN: limited by WAF against bursts, no application quota;
- anonymous search: not offered, or a very low limit;
- search with a key: 30 requests/min per key/colo;
- expensive endpoints: 10 requests/min;
- a maximum of 25 items per page;
- a maximum of 100 pages;
- refresh: entirely internal.

### Degradation policy

| Daily consumption | Action |
|---:|---|
| 0–60% | normal operation |
| 60–75% | pause backfill |
| 75–85% | raise the TTL and reduce preventive refresh |
| 85–95% | stale-only; limit expensive search |
| 95–100% | disable non-essential dynamic routes |
| quota exceeded | fail-closed, a public status page and static objects still available |

Apply a separate policy for the Worker, D1 reads, D1 writes, the Queue and R2.

### Go criteria

- projected p95 traffic below 60 thousand Worker requests/day;
- projected D1 below 3.5 million rows read/day;
- writes below 70 thousand/day;
- the Queue below 7 thousand operations/day;
- R2 below 70% of the monthly allowance;
- ≥90% of popular details served directly by R2/CDN;
- cache key cardinality under control;
- the WAF blocks bursts before the Worker;
- search requires a key or an equivalent limit;
- a miss does not create a job automatically;
- stampede tested;
- degradation tested and documented;
- fail-closed configured;
- alerts at 60/75/85/95%.

### No-go criteria

- public expectations above 100 thousand Worker requests/day;
- a need for unrestricted anonymity in search;
- a bulk/crawling requirement;
- rows read per request make the moderate scenario exceed 5 million/day;
- WAF/rate limiting does not contain abuse;
- a static object has to go through the Worker;
- on-demand refresh exceeds the Queue;
- the product promises an SLA incompatible with fail-closed/a daily quota.

## Sources

- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare — Workers and Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/)
- [Cloudflare Workers Caching](https://developers.cloudflare.com/workers/cache/configuration/)
- [Cloudflare R2 — pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 — cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [Cloudflare R2 — public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 — consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- [Cloudflare D1 — pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 — limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Queues — pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Queues — limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare WAF — rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Workers — Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
