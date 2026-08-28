---
tags:
  - research
  - myanimelist
  - data-sources
  - terms
  - licensing
status: draft
research_date: 2026-07-19
---

# Research — MyAnimeList data sources and terms

## Decision question

**Which source can be used sustainably, and under what conditions?**

## Executive summary

- **Short answer:** the most sustainable source in principle is MyAnimeList's official API, using a registered application and only the uses the applicable terms authorize. Public HTML and internal endpoints must not be considered permitted merely because they are accessible without a login.
- **Direct impact on the project:** there is not enough basis, in this research, to approve crawling or scraping in production. The official terms page and the official API documentation were not accessible to the research tools on 19 July 2026, preventing a high-confidence legal and operational conclusion.
- **Recommendation:** **conditional**. The MVP may proceed with design, contracts and source research, but ingestion from HTML must stay blocked until a manual review of the official terms in force, or written authorization from MyAnimeList. The official API must be evaluated first, by registering an application of our own.

This research is technical and does not replace legal review.

## Verified evidence

| Classification | Fact, hypothesis or inference | Source and consultation | Confidence |
|---|---|---|---|
| Verified fact | Jikan presents itself as an unofficial API that scrapes MyAnimeList to provide functionality missing from the official API. | [Jikan REST API v4](https://github.com/jikan-me/jikan-rest), consulted 2026-07-19. | High |
| Verified fact | Jikan states it is not affiliated with MyAnimeList and assigns the operator/user responsibility for respecting MyAnimeList's terms. | [Jikan REST's README](https://github.com/jikan-me/jikan-rest), consulted 2026-07-19. | High |
| Verified fact | Jikan's public documentation describes a read-only API, without user authentication, with cached data and a broad surface: anime, manga, characters, people, seasons, rankings, reviews, recommendations, users and other resources. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consulted 2026-07-19. | High |
| Verified fact | Official MyAnimeList pages exist for the v2 API, authorization and application configuration. The official URLs are known, but could not be loaded by the tools used in this research. | [Official v2 API reference](https://myanimelist.net/apiconfig/references/api/v2), [authorization](https://myanimelist.net/apiconfig/references/authorization) and [API Config](https://myanimelist.net/apiconfig), attempted 2026-07-19. | High as to the unavailability during the research; low as to the current content |
| Secondary evidence | Wrappers and clients that point at the official documentation describe application registration, use of a `client_id`, OAuth 2.0/PKCE for actions on behalf of a user, and catalog endpoints for anime, manga, rankings and seasons. | [myanimelist-api-v2](https://github.com/Chris-Kode/myanimelist-api-v2) and an [unofficial specification](https://github.com/SuperMarcus/myanimelist-api-specification), consulted 2026-07-19. | Medium |
| Secondary evidence | Current clients report that public catalog queries can use the application's Client ID, while user data and mutations require OAuth. This needs revalidating against the official documentation before use. | [@animelist/client](https://www.npmjs.com/package/@animelist/client) and [Annie Mei — MyAnimeList API](https://anniemei.app/api/myanimelist), consulted 2026-07-19. | Medium |
| Verified fact | No stable public quota for MyAnimeList's official API was found in an accessible primary source. | Research carried out 2026-07-19; the official reference was unavailable. | High as to the absence of evidence found |
| Secondary evidence | A ToS;DR record attributes to MyAnimeList's terms a clause against automated systems, including spiders and robots. Since the official page could not be consulted, that record must not be treated as definitive legal text. | [ToS;DR — case 150](https://edit.tosdr.org/cases/150), consulted 2026-07-19. | Medium-low |
| Verified fact | The `anime-offline-database` project publishes an anime dataset under ODbL 1.0 and DbCL 1.0, with cross-referenced IDs, titles, aliases and aggregated metadata. In July 2026, the README reported 41,537 entries, of which 30,570 had a MyAnimeList reference. | [anime-offline-database](https://github.com/manami-project/anime-offline-database), consulted 2026-07-19. | High |
| Verified fact | The `anime-offline-database` license covers database rights and imposes attribution/share-alike in public derived-database scenarios; it also warns that rights over individual content, such as images and text, may be separate and are not automatically licensed by the ODbL. | [LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE), consulted 2026-07-19. | High |
| Verified fact | Wikidata makes its structured data available under CC0 and recommends dumps for broad extractions, reserving SPARQL for focused queries. There are properties for MyAnimeList IDs, but coverage and quality need to be measured. | [Wikidata:Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright), [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en) and [P4086](https://www.wikidata.org/wiki/Property:P4086), consulted 2026-07-19. | High |
| Verified fact | AniList's API expressly forbids mass collection/hoarding and use as a backup or data store, absent specific permission. It is therefore not an acceptable source for copying a complete catalog by default. | [AniList API Terms of Use](https://docs.anilist.co/guide/terms-of-use), consulted 2026-07-19. | High |
| Inference | Jikan's MIT code license grants no rights over data, synopses, images or other content obtained from MyAnimeList. | Derives from the distinction between a software license and rights over content/a database. The Manami dataset's own license makes a similar distinction explicit. | High |
| Inference | A public internal endpoint is an undocumented product interface, not a redistribution authorization. Its technical accessibility does not determine its permitted use. | A legal/architectural inference; depends on MyAnimeList's terms in force. | High |
| Hypothesis to validate | The official API may cover a large share of the core anime and manga fields, but probably does not offer Jikan's entire surface, especially community resources and detailed pages. | Supported by the surface described by official API clients and by Jikan's documented surface. The current official documentation could not be verified. | Medium |

### The difference between the three classes of source

| Source | Nature | Expected stability | Presumable authorization | Recommended use |
|---|---|---:|---|---|
| Official API | A documented contract and a registered application | Highest | Only per the published terms and scopes | First option |
| Public HTML page | An interface intended for human browsing | Medium/low | **Do not presume** authorization for automation or redistribution | Only after reviewing the terms/getting permission |
| Internal endpoint | An interface used by the frontend, normally with no public commitment | Low | **Do not presume** authorization or stability | Only as an authorized optimization, with a fallback |
| Open dataset | A database published with an explicit license | Variable | Per the dataset's license and that of the individual content | Bootstrap, if the obligations are compatible |

### Gaps between the official API and Jikan

MyAnimeList's official documentation was not accessible. So the following analysis is a **matrix to be confirmed**, not a definitive inventory:

- **Coverage reported with medium confidence:** anime/manga search and detail, rankings, seasons, suggestions, lists and user profile.
- **Confirmed Jikan coverage:** characters, people, staff, episodes, reviews, news, forums, recommendations, statistics, relations, streaming, videos, seasons and rankings.
- **Probable gap:** characters, people, episodes and community content do not appear to have full parity in the official API.
- **Quota and redistribution:** no accessible official quota was found, nor explicit authorization to build a public redistribution/permanent-cache API.

Before deciding that the official API is sufficient or insufficient, the project needs to obtain a current copy of the official reference and produce a field-by-field matrix.

## Architectural implications

1. **The ordering of sources must be legal before it is technical.**
   - An officially authorized source.
   - A dataset with a compatible license.
   - HTML or an internal endpoint only after explicit approval.
   - Local stale data as a fallback.

2. **Provenance needs to be first-class.**
   Each field or document must conceptually have:
   - a source;
   - an origin URL;
   - the applicable license/terms;
   - the date obtained;
   - the parser/adapter version;
   - a known or pending right of retention and redistribution.

3. **Images should stay out of the bootstrap by default.**
   - An image's URL grants no license to copy or redistribute the file.
   - Hotlinking also needs validating against the terms and the CDN's rules.
   - The MVP must treat an image as an optional external reference, not as an asset of its own, until there is a clear basis for use.

4. **Factual data and authored text must be separated.**
   - IDs, dates, counts and relations have a different legal profile from synopses, reviews, biographies and images.
   - The initial scope should favor structured facts and references.
   - Long textual content must require specific analysis.

5. **The project must not depend on a third party's Client ID.**
   - It must register its own application.
   - The application's secret and identity cannot be embedded in public clients.
   - Usage must respect the official API's scopes, rate limits and cache/redistribution rules.

6. **Compatibility with Jikan does not mean copying Jikan's data origin.**
   - The output contract may be compatible.
   - The origin and the license need to be evaluated separately.

## Risks and limits

### Legal/operational blocker

MyAnimeList's official terms page was unavailable for this research. Without the text in force, it is not possible to conclude:

- whether scraping is forbidden in any form;
- whether there are exceptions for research, interoperability or non-commercial use;
- whether caching and redistributing official API responses are permitted;
- whether there is a retention limit;
- whether images may be displayed by hotlink;
- whether a competing/complementary API is authorized;
- whether future commercial use requires an agreement.

The secondary ToS;DR record suggests a broad prohibition on automation. That is enough to prevent approval by silence, but not to replace reading the official text.

### Risk of a contaminating license in the bootstrap

Using a substantial part of `anime-offline-database` may require:

- attribution;
- keeping the notices;
- compatible licensing of the derived database;
- providing the derived database or the changes in a machine-readable format;
- separate analysis of the rights over individual content.

That may be compatible with an open project, but it must be an explicit product and licensing decision.

### No equivalent open source for manga

This research found no current open database equivalent to Manami covering manga, characters and people with a clear and comprehensive license. Therefore:

- the manga bootstrap may start sparse;
- the project must not invent complete coverage;
- the public promise must differentiate anime and manga coverage.

### Dependence on secondary sources

The information about the official API's authentication and endpoints was triangulated from unofficial clients because the primary documentation did not open. It cannot support final compliance decisions.

## Questions still open

- What is the complete text of MyAnimeList's terms in force as of 2026-07-19?
- Are there API-specific terms beyond the site's general terms?
- Does the API allow persistent caching and public redistribution?
- Are there documented limits per Client ID, IP, minute or day?
- Which public endpoints accept only a Client ID, and which require OAuth?
- Does the official API currently offer characters, people, staff, themes, episodes or alternative images?
- Does MyAnimeList grant authorization to services equivalent to Jikan on request?
- Is hotlinking the CDN's images permitted?
- Can synopses and biographies be stored and redistributed?
- Is using the ODbL compatible with the intended license for `jikan-edge`'s database?
- Is there an open, sustainable dataset for manga?
- Do the project's name and presentation need a disclaimer or trademark restrictions?

## Recommendation and go/no-go criteria

### Recommendation

**Conditional.** The project may continue with architecture and contract research, but must not approve scraping/ingestion in production before compliance is concluded.

### Go

The source is approved once all the criteria below are met:

1. the current official terms have been read and archived internally with a date;
2. the intended use — automation, caching and redistribution — is expressly permitted or authorized in writing;
3. the application uses credentials of its own;
4. quotas and a backoff policy are documented;
5. rights over images and text have been evaluated separately;
6. provenance and licensing obligations can be exposed to consumers;
7. a data removal/correction policy exists.

### No-go

Block the source when:

- the terms forbid the applicable automation or redistribution;
- authorization is ambiguous and there is no confirmation from the rights holder;
- the project depends on a third party's credential;
- the source requires forbidden mass collection;
- the database's license is incompatible with the product's license/proposition;
- the individual content has no clear rights and cannot be excluded.

### Required experiment/document

This is not a load experiment. It is a **documentary review**:

- obtain the official pages manually;
- record the version/date;
- create an "intended action × applicable clause" matrix;
- request written clarification from MyAnimeList about automation, retention and redistribution;
- produce a decision signed by the project's owner before any scraping probe.

## Sources

- [MyAnimeList API v2 — official reference](https://myanimelist.net/apiconfig/references/api/v2)
- [MyAnimeList — authorization](https://myanimelist.net/apiconfig/references/authorization)
- [MyAnimeList — API Config](https://myanimelist.net/apiconfig)
- [MyAnimeList — Terms of Use](https://myanimelist.net/about/terms_of_use)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan parser](https://github.com/jikan-me/jikan)
- [ToS;DR — automated systems case](https://edit.tosdr.org/cases/150)
- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
- [anime-offline-database — LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)
- [Wikidata — Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright)
- [Wikidata — Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en)
- [Wikidata — MyAnimeList anime ID](https://www.wikidata.org/wiki/Property:P4086)
- [AniList API — Terms of Use](https://docs.anilist.co/guide/terms-of-use)
- [A secondary v2 API client](https://github.com/Chris-Kode/myanimelist-api-v2)
- [An unofficial API specification](https://github.com/SuperMarcus/myanimelist-api-specification)
