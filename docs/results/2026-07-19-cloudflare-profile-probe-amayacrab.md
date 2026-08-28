# Result — MyAnimeList profile probe on a Cloudflare Worker

> Date: 2026-07-19  
> Scope: one fixed public profile, with no persistence, no authentication and no generic endpoint.

## Goal

Verify whether a Free Worker can fetch and extract basic fields from `https://myanimelist.net/profile/amayacrab` without exceeding the 10 ms CPU budget.

## Spike implementation

- Worker: [`spikes/profile-probe`](../../spikes/profile-probe/)
- Probe URL: `https://jikan-edge-profile-probe.lucas-hdo.workers.dev/probe`
- The profile is hardcoded; the Worker accepts no URL, user or collection parameters.
- No response is stored.
- Fields extracted: user, avatar, last online, gender, location, days and mean score for anime/manga.

## Results

| Step | Result |
| --- | --- |
| Initial local fetch | HTTP 200, `text/html`, approximately 92 KB |
| Initial parser with global regexes | failed on some runs with Cloudflare error `1104` (resource limit) |
| Parser optimized with delimited sections | 5 of 5 responses HTTP 200; no suspicious content |
| Run observed by Cloudflare | `cpuTime: 2 ms`, `wallTime: 393 ms`, `outcome: ok` |
| Fetch observed in the Worker | 391 ms; network wait does not count against the CPU budget |

The observed run happened in the `POA` colo. The Worker was able to identify the profile and extract the expected public statistics. The profile in question contains public data such as location and gender; the spike does not persist it.

## Conclusion

**A partial go for a basic profile parser.** A deliberately small parser, one that avoids repeated global regexes over the complete HTML, stayed under the Free limit in this sample.

That the first parser returned `1104` is just as relevant: a naive strategy of sweeping the whole document with regexes may not have reliable headroom. The metric to protect is the `cpuTime` emitted by Cloudflare's observability, not just the parser's local duration.

## Limitations

- One page and a single observed run do not represent large, private, removed or differently structured profiles.
- One colo does not represent every Cloudflare execution region.
- The test does not validate stability over days, a frequency limit, the source's terms, block pages, canaries or a cache strategy.
- This result does not yet authorize generic endpoints or on-demand scraping for consumers.

## Next tests required

1. Repeat over a small corpus of public profiles with varied structures.
2. Measure p50/p95 of `cpuTime`, not just HTTP success.
3. Test 404 responses, a private/removed profile and a block page.
4. Convert the spike's parser into one testable by fixtures before any persistent ingestion.
