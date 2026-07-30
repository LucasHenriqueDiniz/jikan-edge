// What each route accepts, by Hono route pattern. A route missing from this table is a bug, and
// `tests/routes/query-contract.test.ts` enumerates `app.routes` to prove none is.
//
// This exists because the API used to answer `200` to `?limit=5`, `?sfw` and `?sort=asc` and
// quietly ignore all three — the worst kind of divergence, since the caller has no way to tell it
// did nothing. Silence is now impossible: a parameter is either honoured or refused.
export const QUERY_CONTRACT: Record<string, readonly string[]> = {
  '/health': [],

  // Users
  '/v1/users': ['q', 'page'],
  '/v1/users/:username': [],
  '/v1/users/:username/statistics': [],
  '/v1/users/:username/favorites': [],
  '/v1/users/:username/userupdates': [],
  '/v1/users/:username/full': [],
  '/v1/users/:username/about': [],
  '/v1/users/:username/friends': [],
  '/v1/users/:username/clubs': [],
  '/v1/users/:username/reviews': [],
  '/v1/users/:username/recommendations': [],
  // `limit` is real here and only here: these two paginate over D1, not over a MyAnimeList page.
  '/v1/users/:username/animelist': ['page', 'limit'],
  '/v1/users/:username/mangalist': ['page', 'limit'],

  // Anime
  '/v1/anime': ['q', 'page', 'type', 'status', 'rating', 'score', 'min_score', 'genres', 'genres_exclude', 'order_by', 'sort', 'letter'],
  '/v1/anime/:id': [],
  '/v1/anime/:id/full': [],
  '/v1/anime/:id/relations': [],
  '/v1/anime/:id/external': [],
  '/v1/anime/:id/streaming': [],
  '/v1/anime/:id/characters': [],
  '/v1/anime/:id/staff': [],
  '/v1/anime/:id/statistics': [],
  '/v1/anime/:id/pictures': [],
  '/v1/anime/:id/news': [],
  '/v1/anime/:id/forum': [],
  '/v1/anime/:id/episodes': [],
  '/v1/anime/:id/episodes/:episode': [],
  '/v1/anime/:id/videos': [],
  '/v1/anime/:id/videos/episodes': [],
  '/v1/anime/:id/recommendations': [],
  '/v1/anime/:id/reviews': ['page'],
  '/v1/anime/:id/userupdates': [],
  '/v1/anime/:id/themes': [],
  '/v1/anime/:id/moreinfo': [],

  // Manga
  '/v1/manga': ['q', 'page', 'type', 'status', 'score', 'min_score', 'genres', 'genres_exclude', 'order_by', 'sort', 'letter'],
  '/v1/manga/:id': [],
  '/v1/manga/:id/full': [],
  '/v1/manga/:id/relations': [],
  '/v1/manga/:id/external': [],
  '/v1/manga/:id/characters': [],
  '/v1/manga/:id/statistics': [],
  '/v1/manga/:id/pictures': [],
  '/v1/manga/:id/news': [],
  '/v1/manga/:id/forum': [],
  '/v1/manga/:id/recommendations': [],
  '/v1/manga/:id/reviews': ['page'],
  '/v1/manga/:id/userupdates': [],
  '/v1/manga/:id/moreinfo': [],

  // Characters / People
  '/v1/characters': ['q', 'page'],
  '/v1/characters/:id': [],
  '/v1/characters/:id/full': [],
  '/v1/characters/:id/anime': [],
  '/v1/characters/:id/manga': [],
  '/v1/characters/:id/voices': [],
  '/v1/characters/:id/pictures': [],
  '/v1/people': ['q', 'page'],
  '/v1/people/:id': [],
  '/v1/people/:id/full': [],
  '/v1/people/:id/anime': [],
  '/v1/people/:id/manga': [],
  '/v1/people/:id/voices': [],
  '/v1/people/:id/pictures': [],
  '/v1/people/:id/news': [],

  // Producers / Clubs / Magazines
  '/v1/producers': ['q'],
  '/v1/producers/:id': [],
  '/v1/producers/:id/full': [],
  '/v1/producers/:id/external': [],
  '/v1/clubs': ['page'],
  '/v1/clubs/:id': [],
  '/v1/clubs/:id/staff': [],
  '/v1/clubs/:id/relations': [],
  '/v1/clubs/:id/members': ['page'],
  '/v1/magazines': ['q'],

  // Top / genres / seasons / schedules
  // The accepted values differ by media, and the service enforces that: anime takes all four of
  // Jikan's, manga only `bypopularity` and `favorite`, because topmanga.php has no publishing or
  // upcoming tab and silently serves the unfiltered list for those.
  '/v1/top/anime': ['page', 'filter'],
  '/v1/top/manga': ['page', 'filter'],
  '/v1/top/characters': ['page'],
  '/v1/top/people': ['page'],
  '/v1/genres/anime': ['filter'],
  '/v1/genres/manga': ['filter'],
  '/v1/seasons': [],
  '/v1/seasons/now': [],
  '/v1/seasons/upcoming': [],
  '/v1/seasons/:year/:season': [],
  '/v1/schedules': ['filter'],

  // Watch / recommendations / reviews / random
  '/v1/watch/episodes': [],
  '/v1/watch/episodes/popular': [],
  '/v1/watch/promos': [],
  '/v1/watch/promos/popular': [],
  '/v1/recommendations/anime': ['page'],
  '/v1/recommendations/manga': ['page'],
  '/v1/reviews/anime': ['page'],
  '/v1/reviews/manga': ['page'],
  '/v1/random/anime': [],
  '/v1/random/manga': [],
  '/v1/random/characters': [],
  '/v1/random/people': [],
  '/v1/random/users': [],
};

// Parameters that exist in Jikan v4 but this API does not honour. Refused with a message that says
// *why*, because someone porting from Jikan needs to tell "I typo'd the name" apart from "that
// feature is not here" — and a bare UNKNOWN_PARAMETER cannot say which.
export const UNSUPPORTED_PARAMS: Record<string, string> = {
  limit: 'Not supported outside the user list routes: this API serves one MyAnimeList page per request, so a limit would either slice that page (a different result from Jikan\'s) or require crawling several pages upstream.',
  sfw: 'Not supported: MyAnimeList has no server-side safe-for-work switch, and approximating one by excluding a few genre ids would be a guess wearing the name of a guarantee. Use "genres_exclude" or "rating".',
  max_score: 'Not supported: MyAnimeList\'s search form offers a single minimum-score dropdown, which is what "score" and "min_score" map to.',
  producers: 'Not supported: MyAnimeList\'s search URL has no producer filter. Producer catalogues live at /v1/producers/:id.',
  unapproved: 'Not supported: this API reads the public pages, which list approved entries only.',
  start_date: 'Not supported: the date fields on MyAnimeList\'s advanced search were not confirmed to filter server-side.',
  end_date: 'Not supported: the date fields on MyAnimeList\'s advanced search were not confirmed to filter server-side.',
  preliminary: 'Not supported: MyAnimeList does not separate preliminary reviews on the public pages.',
  spoilers: 'Not supported: MyAnimeList does not separate spoiler reviews on the public pages.',
  kids: 'Not supported: no equivalent switch on the public pages.',
  continuing: 'Not supported: no equivalent switch on the public pages.',
};
