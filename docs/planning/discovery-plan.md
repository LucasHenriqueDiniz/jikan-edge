# Discovery plan

## Goal

Turn the hypothesis "a Cloudflare-native Jikan on Free" into a viability decision based on measurements. This plan does not authorize building the product.

## P0 blockers

| Question | Why it blocks | Evidence required | Go/no-go |
| --- | --- | --- | --- |
| Does the source allow and serve fetches from Cloudflare? | Without a stable source there is no sustainable ingestion. | a sample across days and regions, status, content, block signals and the applicable terms | block scraping if there is a persistent block or an applicable prohibition |
| Does the minimal parser fit on Free? | Workers Free caps CPU per invocation at 10 ms. | p50/p95 and failures across a representative corpus | proceed only with p95 below 8 ms and no overruns in the corpus |
| Does the D1 + R2 model fit the budget? | Writes and search can exhaust the allowances before the traffic does. | cost per entity, size and query over a real corpus | proceed only with a projection below 70% of the target allowance |

## Experiments, once released

1. **Source probe:** a minimal, private route for predefined cases; record only safe metadata (status, size, type, markers, duration and region).
2. **Vertical parser:** one anime entity by ID with minimal fields; measure CPU across at least 50 diverse pages.
3. **Persistence:** a versioned document in R2 and metadata in D1; measure write, read and cache.
4. **Search:** a corpus of at least 30 thousand titles/aliases; evaluate English, romaji and Japanese with FTS5.
5. **Deduplication:** simulate a high volume of requests for the same expired item; validate that only one refresh happens.
6. **Network map:** document what is HTML, what is XHR and what is an authenticated endpoint, without making an internal endpoint an MVP dependency.

## Expected artifacts

- `docs/results/cloudflare-source-probe.md`
- `docs/results/parser-cpu.md`
- `docs/results/storage-budget.md`
- `docs/results/d1-search.md`
- `docs/sources/mal-network-map.md`
- a go/no-go decision in `docs/adr/`

## Success criteria for the future spike

- The source stays available and within the applicable rules.
- No suspicious result replaces a valid document.
- The main parser keeps headroom against the CPU limit.
- The cache reduces repeated work and the API can answer with stale data during a source failure.
- Search finds titles across multiple spellings without expensive sweeps.
- There is a clear projection of the point at which Free stops being enough.
