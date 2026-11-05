/**
 * Markers that prove a fetched MyAnimeList page is the page that was asked for.
 *
 * A marker has to be on every shape of its page — including the one where MAL has nothing to list.
 * The first markers were taken from the rows themselves (`episode-list-data`, `picSurround`,
 * `data-topic-id`, the character table, the `Genre` label), and those are absent exactly when the
 * list is empty: every empty list became `502 UPSTREAM_SUSPICIOUS`. Measured on 2026-11-05, that was
 * 53.6k of the day's 331k requests, all on titles where MAL simply had nothing to show — and since a
 * 502 is never cached, each retry refetched the same page.
 *
 * Telling an empty list from a broken page is the parser's job, against MAL's own "nothing here"
 * notice. Every marker below was checked on a full page and on an empty one, for anime and manga.
 */

// `Score:` sits in the Statistics block, below Information. `Genre` was the second marker until a
// title without genres — Pakkororin (38099) and 273 more in one day — answered 502 on detail and full.
export const DETAIL_PAGE_MARKERS = ['Score:', '<h2>Information</h2>'];

// The list heading, which a page with rows, a title with no episode data and a page past the last
// episode all carry.
export const EPISODES_PAGE_MARKERS = ['<h2 class="h2_overwrite">Episodes</h2>'];

// The section heading differs per medium; both stay when the cast is empty.
export const CHARACTERS_PAGE_MARKERS = {
  anime: ['Characters & Voice Actors</h2>'],
  manga: ['Characters</h2>'],
};

// The heading is marked up differently on anime and manga; the link beside it is the same on both.
export const RECOMMENDATIONS_PAGE_MARKERS = ['Make a recommendation'];

export const FORUM_PAGE_MARKERS = ['class="page-forum"'];
