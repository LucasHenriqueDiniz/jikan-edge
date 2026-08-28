# API v1

| Route | Description |
| --- | --- |
| `GET /health` | Worker state |
| `GET /v1/users/:username` | Normalized profile |
| `GET /v1/users/:username/statistics` | Statistics extracted from the profile |
| `GET /v1/users/:username/animelist?page=1&limit=100` | Anime list paginated over D1 |
| `GET /v1/users/:username/mangalist?page=1&limit=100` | Manga list paginated over D1 |

Every resource response returns `{ data, meta }`. Errors return `{ error: { code, message, requestId } }` with 404, 403, 429, 501, 502, 503 or 504 depending on how the source was classified — the 501 is `LIST_TOO_LARGE`, the only code that does not come from the source: it signals that the list exceeds the 6,000 entries the API reads in one refresh.

`limit` (default 100, maximum 300) **exists only on these two routes**, which paginate over D1. Elsewhere it is a 400 `UNSUPPORTED_PARAMETER`: the response there is a MAL page, and slicing it would give a different result from what the same `limit` means in Jikan.

`page` runs from 1 to 1000, and an invalid value is a 400 `INVALID_PAGE` — it is no longer silently corrected. Every paginated route carries `meta.pagination` with `{ page, limit, count, total, hasNextPage }`; `total` is a number only here, where the count comes from the local database.

A parameter the route does not declare is a 400: `UNKNOWN_PARAMETER` if the name does not exist anywhere, `UNSUPPORTED_PARAMETER` if it exists in Jikan v4 and this API does not honor it — in that case the message says why and points at the substitute.

## Shapes that differ from Jikan v4

Renaming a field is not enough — these change **shape**, and a mechanical `mal_id → malId` leaves `undefined` behind in silence:

| Jikan v4 | here |
| --- | --- |
| `images.jpg.image_url` | `images.medium` — the key is also called `images`, but it is `{ small, medium, large }`, with no jpg/webp split. Any of the three is `null` where MAL's CDN does not have that size. `imageUrl` also exists and is always equal to `images.medium`. |
| `genres[].mal_id` | `genres[].malId` — arrays of `{ malId, name, url }`, the same for `themes`, `demographics`, `studios`, `authors`, `producers` and `licensors` |
| `serialization` (string) | `serializations` (an array of `MalRef`) |
| `aired.prop.from.year` | `aired.from` — `{ from, to, string }`, dates as `YYYY-MM-DD` or `null`, without the `prop` nesting. `string` preserves MAL's own wording. |
| manga search with `episodes` | `volumes` |
| — | `url` on every entity, with MAL's canonical link |

> This page covers only the users core. The complete contract for all 98 routes, with each group's known limitations, is in [`routes.md`](routes.md). The changes that affect consumers are in the [`CHANGELOG.md`](../CHANGELOG.md).
