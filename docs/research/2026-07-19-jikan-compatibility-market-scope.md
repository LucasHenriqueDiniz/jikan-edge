---
tags:
  - research
  - jikan
  - compatibility
  - api-design
  - migration
status: draft
research_date: 2026-07-19
---

# Research — Jikan compatibility and market scope

## Decision question

**Should the MVP be a native API or offer selective compatibility from the start?**

## Executive summary

- **Short answer:** the internal model must be native from the start. A selective `/v4` surface can ship alongside the public beta, but only for high-value routes and with an explicit compatibility contract.
- **Direct impact on the project:** selective compatibility increases migration usefulness without forcing the project to reproduce all of Jikan's complexity, bugs and community endpoints.
- **Recommendation:** **proceed, conditionally**, with `/v1` as the source of truth and a small `/v4` adapter. Do not promise a "drop-in replacement" before measuring real consumers and running contract tests.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | The Jikan v4 documentation exposes a broad, GET-only API, organized into anime, manga, characters, people, seasons, rankings, genres, reviews, recommendations, users, schedules and other resources. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consulted 2026-07-19. | High |
| Verified fact | Jikan documents specific payload conventions: missing scalar values as `null`, missing arrays/objects empty, an unknown score as `0`, ISO 8601 UTC dates and JSON errors. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consulted 2026-07-19. | High |
| Verified fact | Jikan documents pagination, filters, a 24-hour cache, ETag and conditional validation. Compatibility involves more than route names. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consulted 2026-07-19. | High |
| Verified fact | The Jikan site reports more than 100 million requests per month. The number is self-reported and contains no breakdown per endpoint. | [Jikan](https://jikan.moe/), consulted 2026-07-19. | Medium-high |
| Verified fact | The official project lists wrappers in JavaScript, TypeScript, Python, Java, .NET, Go, Dart and other languages. That is evidence of a relevant ecosystem, but it does not reveal the most-used routes. | [Jikan REST README](https://github.com/jikan-me/jikan-rest), consulted 2026-07-19. | High |
| Observational evidence | A public code search on GitHub found a broad presence of anime search/detail URLs, `top/anime` and `seasons/now`. The sample is not complete, suffers from index bias and must not be read as market share. | GitHub Code Search, queries carried out 2026-07-19. | Medium |
| Verified fact | No official public per-endpoint telemetry was found for Jikan. | Research carried out 2026-07-19. | High as to the absence found |
| Inference | Anime search/detail, top and the current season are priority candidates because they appear in the official examples and in many public integrations. | Derived from the documentation and the code sample. | Medium-high |
| Inference | Route compatibility without query/payload/error compatibility does not allow migration without changes. | An API contracts principle. | High |
| Hypothesis to validate | Consumers of manga, characters and people are numerous enough to enter the first `/v4` adapter. | Needs a structured sample and interviews/issues. | Medium |
| Inference | Reproducing every users, reviews, news and forum endpoint would raise cost and dependency on the origin with no proven benefit for the MVP. | Derived from the scope and the source risks. | High |

## Architectural implications

### 1. Four distinct levels of compatibility

#### Conceptual compatibility

The API offers the same general concepts:

- anime;
- manga;
- title;
- score;
- season;
- genre.

It guarantees no migration.

#### Route compatibility

The same paths and methods:

- `/v4/anime`;
- `/v4/anime/{id}`;
- `/v4/top/anime`.

It still guarantees neither parameters nor payload.

#### Payload compatibility

It preserves:

- the `data` envelope;
- `pagination`;
- names and types;
- nulls and arrays;
- dates;
- errors;
- nested references.

#### Behavioral compatibility

It preserves:

- filters;
- defaults;
- sorting;
- page limits;
- 404/400/429;
- cache headers;
- ETag;
- edge cases.

Only this level comes close to "drop-in".

### 2. A native internal model

The internal contract must not take on Jikan's quirks:

- inconsistent names;
- an unknown score as zero;
- fields derived from the current structure;
- historical bugs;
- pagination limits.

The `/v4` adapter converts from the native model. That allows us to:

- evolve `/v1`;
- keep selective compatibility;
- document fields with no source;
- drop incompatible routes without corrupting the core.

### 3. A suggested selective scope

The prioritization below is a **proposal to validate**, not official telemetry.

#### Tier A — basic migration

- anime search;
- anime detail;
- manga search;
- manga detail;
- top anime;
- top manga;
- the current season.

#### Tier B — common catalog pages

- full anime/manga detail;
- the upcoming season;
- a season by year/season;
- genres;
- an anime's characters;
- character detail;
- person detail.

#### Tier C — only after demand and a source

- episodes;
- statistics;
- recommendations;
- alternative images;
- streaming;
- schedules;
- producers/magazines.

#### Outside the MVP

- users;
- lists;
- history;
- friends;
- reviews;
- news;
- forums;
- clubs;
- user updates.

### 4. Compatibility must be declared in a matrix

For each route:

- the path;
- accepted parameters;
- ignored parameters;
- complete fields;
- partial fields;
- always-null fields;
- pagination semantics;
- caching;
- errors;
- status: experimental, partial or compatible.

Do not use a generic "Jikan compatible" badge.

### 5. Recommended versioning

- `/v1`: the native API, a contract controlled by the project;
- `/v4`: an adapter for selective compatibility with Jikan v4;
- a header or metadata endpoint: the adapter's matrix/version;
- incompatible changes in the adapter require a version or a deprecation period;
- the native model can evolve with extra fields without affecting `/v4`.

## Risks and limits

### The absence of per-endpoint telemetry

The prioritization is based on:

- documentation;
- examples;
- wrappers;
- a public code search.

Those sources over-represent tutorials and open projects and under-represent private applications. A consumer survey is necessary.

### "Drop-in replacement" as a dangerous promise

Small differences break clients:

- `null` versus `[]`;
- number versus string;
- pagination;
- a zero score;
- compound filters;
- result ordering;
- 404;
- field names;
- image URLs;
- incomplete dates.

The project should use "selective compatibility" until it passes real tests.

### The cost of `/full`

An aggregated endpoint can:

- perform several reads;
- generate a large payload;
- raise CPU;
- depend on resources that are not refreshed together.

It may be necessary to store a prepared view or accept eventual consistency. That must be measured, not presumed.

### Search parity

Even with the same route, results can differ because of:

- our own index;
- aliases;
- relevance;
- a partial catalog;
- filters;
- refresh.

The adapter must document that compatibility of shape does not mean identical ranking.

### The risk of coupling to a shutdown

Building only to capture an immediate migration can freeze an API with inherited decisions. The product needs to preserve a proposition of its own and its sustainability.

## Questions still open

- Which endpoints represent 80% of Jikan's real traffic?
- Which libraries/wrappers have the largest installed base?
- How many consumers use URLs directly versus wrappers?
- Which `/full` fields are actually required?
- Are there consumers that depend on ETag and cache headers?
- Which `/anime` and `/manga` filters are most used?
- Are characters and people MVP or a later phase?
- What tolerance do users have for stale/partial data?
- Will the `/v4` adapter be free and anonymous?
- Will the native API offer clear advantages?
- How do we communicate incompatible routes?
- Which name avoids confusion with Jikan's official service?

## Recommendation and go/no-go criteria

### Recommendation

**A native API as the core; selective compatibility in the public beta.**

Do not implement full parity. The initial adapter must be limited to routes that:

- have observed demand;
- can be covered by an approved source;
- fit on Free;
- have contract tests;
- do not require community content.

### Additional market research

Before freezing the scope:

1. select 30–50 active repositories that use Jikan;
2. include different languages and wrappers;
3. record the routes, parameters and fields accessed;
4. exclude duplicate tutorials;
5. verify recent activity;
6. open a public survey/issue about migration;
7. build a qualitative frequency matrix;
8. do not publish counts as market share.

### Contract testing

For each candidate route:

- collect public Jikan fixtures while they are available;
- compare status, relevant headers, schema and types;
- test query defaults and invalid inputs;
- run popular SDKs/wrappers against a mock of the contract;
- measure the share of requests that need no change.

### Go criteria

- at least 20 active consumers analyzed;
- Tier A represents a clear majority of the observed flows;
- an authorized source covers at least 95% of Tier A's mandatory fields;
- 100% of the selected schema's mandatory names and types are reproduced;
- at least 95% of the sample's Tier A requests work with no change;
- errors and pagination have a tested contract;
- the estimated cost per route stays within the Free model;
- the documentation spells out the incompatibilities;
- `/v1` remains independent.

### No-go criteria

- consumers depend mostly on routes outside the scope;
- the source does not cover essential fields;
- the aggregated payload exceeds CPU/storage;
- compatibility requires reproducing unauthorized content;
- the adapter increases writes/reads beyond the budget;
- the team cannot maintain the contract tests;
- marketing demands "drop-in" with no evidence.

## Sources

- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan parser](https://github.com/jikan-me/jikan)
- [Jikan website](https://jikan.moe/)
- [Jikan GitHub organization](https://github.com/jikan-me)
- [JikanPy](https://github.com/abhinavk99/jikanpy)
