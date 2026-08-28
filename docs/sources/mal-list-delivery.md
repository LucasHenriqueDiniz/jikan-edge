# How MAL delivers lists

## Current state (2026-07-30)

MAL renders a user's list in **two different layouts**, and which one is served depends on a setting the user controls — not on the URL, not on the User-Agent, not on the network:

- **Classic**: a server-rendered table, with `class="animetitle"` anchors.
- **Modern**: the entries come as a JSON array inside the `data-items` attribute; the table is assembled by JS.

The list URL needs the **`?status=7`** parameter (the "All" tab). Without it:

- in the modern layout the page carries **a single entry** — the rest would come from `load.json`, an internal endpoint `docs/source-policy.md` forbids;
- in the classic layout the page carries **fewer rows than the profile declares**.

With `?status=7`, both layouts serve the whole list from the public page. Pagination via `&offset=` in blocks of 300 applies **only to the modern layout**; the classic one ignores the offset and returns everything in a single document.

Real measurements (2026-07-30), checked against the `totalEntries` that `/v1/users/:u/statistics` reports for each user:

| User | Layout | Without `status=7` | With `status=7` | Profile declares |
| --- | --- | ---: | ---: | ---: |
| AMayacrab | classic | 273 | 360 | 360 |
| Zel | classic | 514 | 514 | 514 |
| Xinil | modern | 1 | 300 + 99 = 399 | 399 |
| jet2r0cks | modern | 1 | 898 | 898 |
| Karinyia | modern | 1 | 2,354 (8 pages) | 2,354 |

**A numeric title arrives as a JSON number, not a string.** MAL does not add quotes when the title looks like a number: `86` (the anime *86 Eighty-Six*), `1`, `663114`. Reading only strings emptied those titles, and an empty title fails the schema — since one invalid item rejects the whole page, a single anime called "86" brought down a list of 2,354 entries.

**The `data-items` attribute has to be read raw.** Passing it through the `decodeHtml` helper (used by `capture()`) corrupts the payload silently: it decodes `&amp;` before `&quot;`, strips anything tag-shaped and collapses repeated whitespace — all three destroy the title or the JSON without raising an error.

## Completeness guards

The list page **declares nowhere how many entries the list has** — the counters next to "All Anime" are drawn by JS. So there is no total to extract from the document, and the only possible comparison is against the `totalEntries` of the profile already persisted in D1:

- extracting **fewer** than declared → snapshot rejected (502), with the counts in the message;
- extracting **more** → accepted: a counter cached before the user added entries legitimately lags behind;
- with no cached profile → no counter, and the list is served without that check.

Beyond that: a snapshot is only accepted with unique IDs and a terminal `</html>` marker; an empty list, truncated HTML, duplicates or an invalid item all result in rejection and **never** replace what is already in D1. Passing the ceiling of 20 pages (6,000 entries) raises a 501 `LIST_TOO_LARGE` instead of storing a prefix.

## Historical record — what was believed on 2026-07-19, and why it was wrong

The previous version of this document stated:

> On 2026-07-19, `https://myanimelist.net/animelist/AMayacrab` returned 595,422 bytes and 273 anime links (…). Inspecting the HTML found no `offset`, `page`, `ajax` or `xhr`. Current decision: treat the page as a single-page snapshot.

Three errors, all confirmed on 2026-07-30:

1. **The 273 links were the truncated list, not the list.** AMayacrab's profile declares 360 entries. The number was recorded as if it were the total, and the API served 273 as a 200 response until it was fixed — the most dangerous failure mode found in this project so far, because there was no error at all.
2. **`offset` exists and works** as a query param on the public URL. Searching the HTML for those words found nothing because JS builds them.
3. **The "single page" conclusion was generalized from one profile** that happened to use the classic layout. AMayacrab was the reference profile for the whole project, and the modern layout — which broke the route with a 502 — only surfaced when sweeping different users.

The practical lesson: a reference profile is not a sample. When touching lists, test at least one user of each layout and check the count against the profile's `totalEntries`.
