// A pointer to another MyAnimeList entity — a genre, a studio, an author, a magazine.
//
// These used to be plain `string[]` of names, which broke the round trip inside this very API:
// `GET /v1/anime?genres=1` takes numeric ids, but no response ever handed one back, so a consumer
// could filter by genre yet never learn a title's genre ids. The id was in the page all along —
// `<a href="/anime/genre/1/Action">` — and only the anchor text was being kept.
export interface MalRef {
  malId: number;
  name: string;
  url: string;
}
