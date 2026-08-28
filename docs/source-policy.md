# Source policy

Only `https://myanimelist.net` over HTTPS is allowed. URLs are centralized in `src/source/mal-urls.ts`; they never come from the client. The client uses a timeout, a maximum size, a content-type check, required markers and a configurable user-agent.

Login, CAPTCHA, challenge, rate limit, empty HTML, a generic redirect and a document without its essential structure are all suspicious responses. They do not overwrite D1 content that is already valid. There is no mass sweeping, no headless browser and no internal endpoint.
