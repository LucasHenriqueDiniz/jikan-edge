---
tags:
  - research
  - bootstrap
  - catalog
  - datasets
  - provenance
status: draft
research_date: 2026-07-19
---

# Research — Catalog bootstrap strategy

## Decision question

**How do we start useful coverage without exceeding limits or creating an unviable operational dependency?**

## Executive summary

- **Short answer:** start with a licensed seed of identities and aliases for anime, complement the current season/rankings from an authorized source, and expand on demand. Do not try to clone all of MAL before launch.
- **Direct impact on the project:** the MVP can offer useful anime coverage with tens of thousands of IDs without any initial crawling, but manga, characters and people will probably start with partial coverage.
- **Recommendation:** **proceed, conditionally**. Use an open dataset only after accepting its licensing obligations; keep bootstrap and updating separate; do not use AniList for hoarding; do not treat a Jikan snapshot as automatically redistributable.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | `anime-offline-database` aggregates metadata and cross-references from multiple providers. In its July 2026 README it reports 41,537 entries and 30,570 MyAnimeList references. | [anime-offline-database](https://github.com/manami-project/anime-offline-database), consulted 2026-07-19. | High |
| Verified fact | The dataset offers compressed JSON/JSONL files and periodic releases; the GitHub repository was marked as archived, although the README indicated a recent update. | [Repository](https://github.com/manami-project/anime-offline-database) and [releases](https://github.com/manami-project/anime-offline-database/releases), consulted 2026-07-19. | High |
| Verified fact | The license is ODbL 1.0 for the database and DbCL 1.0 for the content, with attribution and share-alike obligations for public uses of a derived database. Rights over individual content may remain separate. | [LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE), consulted 2026-07-19. | High |
| Verified fact | The Manami dataset is about anime; on its own it does not solve manga, characters, people, reviews or episodes. | [README and schema](https://github.com/manami-project/anime-offline-database), consulted 2026-07-19. | High |
| Verified fact | Wikidata makes structured data available under CC0, has a MyAnimeList anime ID property and recommends dumps for broad extractions. | [Wikidata Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright), [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en) and [P4086](https://www.wikidata.org/wiki/Property:P4086), consulted 2026-07-19. | High |
| Verified fact | AniList forbids using its API as a backup/store and forbids hoarding/mass collection without authorization. | [AniList API Terms](https://docs.anilist.co/guide/terms-of-use), consulted 2026-07-19. | High |
| Verified fact | R2 Free includes 10 GB-month, 1 million Class A operations and 10 million Class B per month. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), consulted 2026-07-19. | High |
| Verified fact | D1 Free includes 100,000 rows written per day, 5 million rows read per day and 5 GB total; each Free database is limited to 500 MB. Indexes also contribute to writes and storage. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | Queries/imports run by Cloudflare's tools also count toward the usage metrics; D1 returns `rows_read` and `rows_written` for measurement. | [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) and [D1 return objects](https://developers.cloudflare.com/d1/worker-api/return-object/), consulted 2026-07-19. | High |
| Inference | A seed of approximately 41 thousand anime objects fits numerically within R2's monthly allowance of 1 million writes, provided each entity results in few objects and does not include images. | Inferred from the allowances; the real size needs measuring. | High |
| Inference | The D1 limit will probably be reached by aliases, FTS and relations before the plain entity count, because one entity can generate many rows written, indexes included. | Derived from D1's billing model. | High |
| Hypothesis to validate | Manami provides sufficient coverage for at least 90% of the current season and of MAL's top 100. | Needs measuring against the chosen release. | Low |
| Fact not found | No current, comprehensive open source with a clear license was identified as an equivalent for manga, characters and people. | Research on 2026-07-19. | Medium |

## Architectural implications

### 1. Bootstrap must not be a synonym for complete content

The initial seed needs to provide mainly:

- the MAL ID;
- the main title;
- aliases;
- type;
- status;
- season/year;
- cross-references;
- the image URL, as a reference only;
- provenance;
- the license.

Dynamic and authored fields must be updated separately:

- score;
- rank;
- members;
- synopsis;
- background;
- detailed relations;
- characters;
- staff;
- streaming.

### 2. Recommended layered strategy

#### Layer A — anime identity

Use a compatible open source to:

- create the initial universe of IDs;
- populate search by title/alias;
- avoid a sequential sweep of IDs;
- mark each record as `seed`, not as data confirmed by the current upstream.

#### Layer B — the hot set

Update from an authorized source:

- the current season;
- the next season;
- the top 100/500;
- accessed titles;
- works related to the hot set.

#### Layer C — demand

When a known ID is requested:

- serve the seed if it is sufficient;
- schedule enrichment;
- promote to a verified document;
- do not create synchronous scraping.

#### Layer D — controlled backfill

Only after observing quota headroom:

- popular older items;
- titles with incomplete coverage;
- high-demand relations;
- priority manga and characters.

### 3. Coverage needs to be measurable

Each entity must have a conceptual state:

- `seeded`;
- `verified`;
- `stale`;
- `partial`;
- `missing`;
- `source-restricted`;
- `removed`.

The API must be able to expose:

- the date of the last verification;
- coverage;
- the source;
- unavailable fields;
- confidence.

### 4. Field-level provenance

Mixing sources without traceability creates inconsistencies and incompatible obligations. Relevant fields need to record:

- the origin;
- the license;
- the date;
- the precedence rule;
- the transformation applied;
- whether removal is possible.

### 5. The import must be offline and reproducible

The bootstrap process must not consume the HTTP Worker or depend on Queues. The project should produce, as a research/operations artifact:

- the dataset's hash;
- the version/release;
- the license;
- counts;
- a validation report;
- size before/after;
- estimated and actual rows written;
- R2 objects;
- inconsistencies;
- coverage by category.

That describes the process; it does not imply implementation at this stage.

## Risks and limits

### ODbL obligations

If the project reuses a substantial part of Manami for a public derived database, it may need to:

- attribute the dataset;
- keep the license;
- make the derived database or the differences available;
- prevent additional terms that restrict the rights granted;
- separate out individual content with different rights.

The decision to use Manami must come with a licensing decision for `jikan-edge`'s database.

### An archived repository

An archived dataset can keep publishing releases, but:

- future maintenance is not guaranteed;
- the schema may freeze;
- the sources may go out of date;
- the project must not depend on it for daily updates.

It is suitable as a versioned seed, not as the sole operational upstream.

### Images

Image URLs may be in the dataset, but:

- the database's license grants no right over the image;
- copying images into R2 is not approved;
- hotlinking needs its own analysis;
- URLs can expire or change.

### Asymmetric coverage

Anime may start with good coverage; manga, characters and people may start empty or sparse. That needs to appear in the public documentation, without claiming general parity.

### Write amplification in D1

An anime with many aliases can generate:

- one main row;
- dozens of aliases;
- search tokens;
- relations;
- genres;
- indexes.

Batching reduces round trips, but not necessarily the rows written that are billed. The budget needs to be calculated with real data.

### Importing FTS

Cloudflare documents support for FTS5, but exporting databases with virtual tables has limitations. The recovery plan must keep the source dataset and allow the index to be rebuilt, rather than depending on a D1 export alone.

## Questions still open

- Which Manami release will be the baseline?
- Will the repository keep producing releases after July 2026?
- Is the ODbL license compatible with the planned license?
- How much of the dataset is derived from MAL and how much is aggregated?
- What is the coverage of the current season, the top 100, the top 500 and upcoming releases?
- How many aliases exist on average and at p99?
- What is the compressed/uncompressed size?
- How many rows written are generated per entity in the chosen index?
- Does the anime database with FTS stay below 500 MB?
- Which authorized source will cover manga?
- How do we handle removed/reinstated IDs?
- How do we resolve divergences between the seed and the current source?
- Should the bootstrap include synopses or only structured facts?
- What update policy applies to records never accessed?

## Recommendation and go/no-go criteria

### Recommendation

**Proceed, conditionally**, with a strategy of useful rather than total coverage:

1. a licensed seed for anime;
2. verification of the current season and the tops;
3. expansion on demand;
4. backfill only with budget to spare;
5. manga declared as partial coverage until a sustainable source exists.

### Seed evaluation experiment

Without implementing the product, prepare an analysis over a frozen release:

- validate the schema and the license;
- measure the total entries;
- extract the MAL IDs;
- compare against the current season and the top 500 from an authorized source;
- measure aliases, relations and size;
- project the R2 objects;
- project and then measure rows written in a test environment;
- record the fields that carry separate rights.

### Go criteria

- license and obligations approved;
- the dataset reproducible by release/hash;
- at least 90% coverage of the current anime season;
- at least 95% coverage of the anime top 100;
- no image copied without a license;
- the projected import below 70% of R2's monthly Class A allowance;
- D1 loaded in stages below 70% of the daily write allowance;
- each database projected below 400 MB, leaving headroom;
- the index rebuildable from the seed;
- provenance and coverage status available;
- hot updates independent of the seed.

### No-go criteria

- ODbL obligations incompatible with the project's strategy;
- a dataset with no verifiable releases;
- content rights mixed together with no possibility of separation;
- a need for indiscriminate crawling to make the seed useful;
- the import systematically exceeds the limits and cannot be partitioned;
- insufficient season/top coverage;
- no sustainable path for corrections and removals.

## Sources

- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
- [anime-offline-database — releases](https://github.com/manami-project/anime-offline-database/releases)
- [anime-offline-database — LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)
- [Wikidata — Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright)
- [Wikidata — Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en)
- [Wikidata — MyAnimeList anime ID](https://www.wikidata.org/wiki/Property:P4086)
- [AniList API Terms of Use](https://docs.anilist.co/guide/terms-of-use)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
