---
tags:
  - research
  - cloudflare-d1
  - sqlite
  - fts5
  - search
  - multilingual
status: draft
research_date: 2026-07-19
---

# Research — Multilingual search with D1 and FTS5

## Decision question

**Is D1/FTS5 sufficient for the search and filters MVP?**

## Executive summary

- **Short answer:** D1/FTS5 is a plausible basis for the MVP, especially for English, romaji, aliases and structured filters. Its sufficiency for Japanese and substring search is not proven.
- **Direct impact on the project:** the MVP can avoid a paid search service, but it needs normalized aliases and a real benchmark; `unicode61` on its own is probably insufficient for partial Japanese queries.
- **Recommendation:** **conditional**. Proceed with D1 as the main candidate, comparing `unicode61`, trigram, normalized prefixes and an alias table. Approve only if quality, latency, rows read, writes and size pass the defined thresholds.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | D1 supports SQLite FTS5 and `fts5vocab`. | [D1 supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/), consulted 2026-07-19. | High |
| Verified fact | FTS5's default tokenizer is `unicode61`; it treats contiguous sequences of letters/numbers as tokens, is case-insensitive and strips Latin diacritics by default. | [SQLite FTS5](https://www.sqlite.org/fts5.html), consulted 2026-07-19. | High |
| Verified fact | FTS5 offers prefix queries; prefix indexes can speed those queries at the cost of more entries and storage. | [SQLite FTS5 — prefix queries/indexes](https://www.sqlite.org/fts5.html), consulted 2026-07-19. | High |
| Verified fact | The `trigram` tokenizer turns contiguous three-character sequences into tokens and enables substring search. FTS queries shorter than three characters produce no matches. | [SQLite FTS5 — trigram tokenizer](https://www.sqlite.org/fts5.html), consulted 2026-07-19. | High for SQLite |
| Verified fact | Trigram can speed up `LIKE` and `GLOB` in certain configurations; patterns without a non-wildcard sequence of at least three characters fall back to a linear scan. | [SQLite FTS5 — trigram tokenizer](https://www.sqlite.org/fts5.html), consulted 2026-07-19. | High for SQLite |
| Verified fact | D1 Free offers 5 million rows read/day, 100 thousand rows written/day, 5 GB total and 500 MB per database. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | D1 limits `LIKE`/`GLOB` patterns to 50 bytes. In UTF-8, the number of Japanese characters that fit is fewer than 50. | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), consulted 2026-07-19. | High |
| Verified fact | D1 exposes rows read, rows written, SQL duration and database size per query, allowing a cost benchmark. | [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) and [return objects](https://developers.cloudflare.com/d1/worker-api/return-object/), consulted 2026-07-19. | High |
| Verified fact | Each D1 database processes queries single-threaded. A single database can become a bottleneck under concurrency. | [D1 limits — concurrency](https://developers.cloudflare.com/d1/platform/limits/), consulted 2026-07-19. | High |
| Inference | A Japanese title with no spaces may be treated by `unicode61` as a single long token. So a prefix from the start may work, but a substring in the middle is not guaranteed. | A direct inference from the tokenizer's rules. | High |
| Inference | `unicode61`'s diacritic stripping is useful for searches like "Pokémon"/"Pokemon", but it does not solve romanization, kana/kanji or spelling mistakes. | Derived from the tokenizer's behavior. | High |
| Hypothesis to validate | The SQLite build D1 uses makes the trigram tokenizer available with the behavior SQLite documents. D1's documentation confirms FTS5, but does not explicitly enumerate every compiled tokenizer. | Needs a capability query against a real D1. | Medium |
| Hypothesis to validate | A complete trigram index can fit under 500 MB for anime and manga, aliases included. | Needs a benchmark. | Low |
| Inference | Structured filters for score, year, season, type and status are better served by ordinary SQL indexes than by FTS. | A relational modeling principle. | High |

## Architectural implications

### 1. Search needs multiple strategies

A single FTS query must not determine all relevance. The conceptual pipeline:

1. an exact ID match;
2. an exact normalized title/alias;
3. a title/alias prefix;
4. FTS by tokens for English and romaji;
5. trigram/substring for Japanese and fragments;
6. a tiebreak by popularity and alias quality.

### 2. Normalizations required

Without settling on an implementation, the corpus needs to evaluate:

- Unicode normalization, preferably NFKC;
- case folding;
- optional stripping of Latin diacritics;
- whitespace and punctuation;
- hyphens, apostrophes and colons;
- symbols such as `★`, `×`, `!`, `?`;
- the `ou`/`ō`, `uu`/`ū` variants;
- official romaji titles;
- kana and kanji;
- aliases in different languages;
- Roman and Arabic numerals;
- articles and subtitles.

Do not generate romanization automatically as canonical truth without evaluating the errors; prefer aliases supplied by an authorized source.

### 3. FTS and filters must be separate

- FTS returns candidates and textual relevance.
- SQL applies the structured filters.
- Sorting by score/popularity needs an index of its own.
- The benchmark must measure rows read after combining search and filters, not FTS in isolation.

### 4. A rebuildable index is mandatory

FTS5 can be treated as derived:

- origin: the titles/aliases table;
- index: rebuildable;
- backup: the dataset and aliases, not just the D1 file;
- migration: recreate the index when the tokenizer/normalization changes.

Cloudflare's documentation notes export limitations where there are virtual tables; that reinforces the need for rebuilding.

### 5. Alternatives without a paid service

#### Alternative A — normalized aliases + B-tree

Suitable for:

- equality;
- prefixes;
- very short titles;
- high precision.

Limitation: weak substring and typo tolerance.

#### Alternative B — FTS5 `unicode61`

Suitable for:

- English/romaji;
- words;
- diacritics;
- BM25 ranking.

Limitation: Japanese without spaces, and substrings.

#### Alternative C — FTS5 trigram

Suitable for:

- substrings;
- scripts without segmentation;
- partial aliases.

Limitations:

- a three-character minimum in MATCH;
- greater storage and write amplification;
- quality/relevance needs calibrating;
- availability in D1 needs confirming.

#### Alternative D — a precomputed prefix index

Suitable for:

- controlled autocomplete;
- predictability.

Limitations:

- more rows written;
- a storage blowup;
- the size and number of prefixes need limiting.

#### Alternative E — a static index in R2/CDN

Suitable for:

- small catalogs or shards by prefix;
- reducing D1 use in autocomplete.

Limitations:

- updating and invalidation;
- the payload sent to the client;
- it does not replace complex filters;
- it can expose the entire catalog.

## Risks and limits

### Relevance is not only matching

Results need to consider:

- the main title versus an alias;
- an exact versus a partial match;
- language;
- popularity;
- media type;
- duplicates;
- sequential seasons;
- works with nearly identical titles.

Default BM25 does not know those rules on its own.

### Short Japanese

One- and two-character queries are especially hard:

- trigram finds nothing;
- `LIKE` may scan;
- prefix tables can explode;
- many results are semantically ambiguous.

The MVP may require a three-character minimum for free-text search, keeping ID and exact match for shorter queries.

### Size per database

The 500 MB limit includes:

- tables;
- B-tree indexes;
- FTS;
- aliases;
- free pages;
- metadata.

Separating anime and manga may be necessary, but only after measurement. Premature sharding complicates queries and migration.

### Write amplification

Updating one title can modify:

- the canonical row;
- aliases;
- FTS;
- indexes;
- relations.

D1 counts rows written for indexes too. The benchmark needs to measure updating, not just the initial load.

### Concurrency

A single-threaded database may support the MVP, but expensive searches and scans can block other queries. The p99 and the query queue matter as much as the median.

## Questions still open

- Is the trigram tokenizer enabled in the current D1?
- What is `unicode61`'s quality for kana and kanji?
- Which Japanese titles are tokenized as a single sequence?
- What is the index size at 10 thousand, 40 thousand and 100 thousand entities?
- How many aliases per entity exist at p50/p95/p99?
- Does an FTS prefix index improve things enough to justify the storage?
- Which relevance algorithm handles sequels, remakes and alternative titles?
- How do we handle spelling mistakes without an external service?
- Does the 50-byte LIKE limit affect real queries?
- Which filters multiply rows read the most?
- Is a single 500 MB database enough for anime?
- Does search need to return manga and anime in a single call?
- What behavior will be compatible with Jikan for queries shorter than three characters?

## Recommendation and go/no-go criteria

### Recommendation

**Conditional.** D1/FTS5 is the first option, but it must not be approved without a multilingual benchmark.

### Benchmark corpus

Recommended minimum:

- 10 thousand entities for the initial iteration;
- 30–50 thousand anime for a near-real test;
- a separate manga sample;
- the main, English and Japanese titles and every alias;
- cases with accents, macrons, symbols, numbers and punctuation;
- at least 500 manually evaluated queries.

Query classes:

- ID;
- an exact title;
- an exact alias;
- a prefix;
- an internal word;
- a Japanese substring;
- romaji without macrons;
- a stripped diacritic;
- a one-character typo;
- a sequel/season;
- a title with a symbol;
- one, two and three characters.

### Metrics

- precision@1;
- precision@5;
- recall@10;
- MRR@10;
- nDCG@10;
- p50/p95/p99 SQL latency;
- rows read per query;
- rows written per insert and update;
- total database size;
- incremental size per thousand entities;
- queries per second under moderate concurrency;
- the share of queries that fall back to a scan.

### Go criteria

Proposed project thresholds:

- exact/alias match: precision@1 ≥ 0.98;
- English/romaji: recall@10 ≥ 0.95;
- Japanese with three or more characters: recall@10 ≥ 0.90;
- prefix/autocomplete: precision@5 ≥ 0.90;
- p95 SQL ≤ 50 ms over the complete corpus;
- p99 SQL ≤ 150 ms;
- p95 rows read ≤ 500 for an ordinary query;
- no ordinary query reads more than 10 thousand rows;
- projected database ≤ 400 MB;
- average update ≤ 30 rows written per entity;
- no dependence on a linear scan for normal flows;
- the index can be rebuilt from the source dataset.

### No-go criteria

- trigram unavailable and partial Japanese insufficient;
- the database exceeds 500 MB with inadequate headroom;
- rows read exceed 5 million/day in the moderate scenario;
- writes make hot updates unviable;
- p95/p99 incompatible with the API;
- relevance requires complex external logic;
- ordinary queries depend on a LIKE with a scan.

### Alternative plan

If D1 fails:

1. keep D1 for filters and exact/prefix;
2. serve basic search by aliases;
3. limit substring/typo tolerance;
4. generate static autocomplete shards;
5. defer advanced search until there is budget for a dedicated engine.

## Sources

- [Cloudflare D1 — supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Cloudflare D1 — pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 — limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 — metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Cloudflare D1 — return objects](https://developers.cloudflare.com/d1/worker-api/return-object/)
- [Cloudflare D1 — import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html)
