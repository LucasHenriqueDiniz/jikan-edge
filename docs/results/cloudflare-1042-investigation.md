# Cloudflare 1042/404 investigation

State: **not reproduced**.

After publishing `a4d5243b-38d3-4046-a3bf-1aeeeab9b678`, five controlled calls were made, one second apart, to the health, profile, statistics, anime list and manga list of `AMayacrab`. All returned 200, the application's request ID, a `hit` cache status (except for health) and a CF-Ray in the POA colo. There was no 1042 and no 404.

The headers also returned `x-worker-version: 21d161a6-1a5e-400c-a823-7b4cbac00243`, even though the new configuration declares `jikan-edge-2026-07-19`. That indicates the sample was taken during release/configuration propagation or edge caching; it is not evidence that the new code ran. The responses do carry a request ID, so they did reach the application.

The Worker does not fetch `workers.dev` and does no Worker-to-Worker fetch. Cloudflare's documentation associates 1042 with a Worker-to-Worker fetch without the appropriate flag, a hypothesis neither the code nor the sample confirms. Without a correlated `wrangler tail`/trace at the moment of an error, the origin is **undetermined**. Mitigation: keep calls spaced out, keep the request/version/cache headers, and collect a Tail if the error reappears; there is no safe code fix to apply without a reproduction.
