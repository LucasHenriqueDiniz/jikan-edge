# Source strategy — public scraping

> State: a discovery decision. No implementation.

## Decision

`jikan-edge` will investigate an API of its own based on scraping MyAnimeList's public HTML pages. MyAnimeList's official API is out of the initial scope.

## Motivation

The goal is to reproduce the public, cached data model that made Jikan useful, without depending on the official API's coverage, credentials or contract.

## Non-negotiable rules

- Collect only content that is publicly accessible and needs no session.
- Do not automate login, do not store user cookies and do not expose private data.
- Do not solve CAPTCHAs, defeat challenges, forge a browser identity or work around rate limits/blocks.
- Do not collect on the synchronous path of a consumer's request.
- Apply caching, stale-while-revalidate, refresh deduplication, a low cadence and backoff.
- Validate the status, type, title, expected markers and schema before persisting a response.
- Preserve the last valid version when the source fails or answers with suspicious content.

## Consequence for the research

The priority questions become:

1. Is the HTML delivered to Workers stable and semantically valid?
2. Does the minimal parser fit the Free plan's CPU budget?
3. What cadence keeps the source stable without abusive behavior?
4. Which fields is it actually possible to extract and maintain?
5. How do we detect a structural change and degrade to stale data?

## What remains open

This decision does not declare that scraping is permitted or sustainable. Before any implementation, the project still needs to verify the terms in force, run a controlled probe and decide the stopping criterion in the face of blocks or source changes.
