import { registerUsersRoutes } from './http/routes/users.routes';
import { registerAnimeRoutes } from './http/routes/anime.routes';
import { registerSeasonsRoutes } from './http/routes/seasons.routes';
import { registerMangaRoutes } from './http/routes/manga.routes';
import { registerCharactersRoutes } from './http/routes/characters.routes';
import { registerProducersRoutes } from './http/routes/producers.routes';
import { registerClubsRoutes } from './http/routes/clubs.routes';
import { registerPeopleRoutes } from './http/routes/people.routes';
import { registerWatchRoutes } from './http/routes/watch.routes';
import { registerRecommendationsRoutes } from './http/routes/recommendations.routes';
import { registerReviewsRoutes } from './http/routes/reviews.routes';
import { registerRandomRoutes } from './http/routes/random.routes';
import { Hono } from 'hono';
import { type App, type AppContext, background, type Variables } from './http/app-context';
import { configFrom, type Env } from './config/env';
import { registerQueryGuards } from './http/query-guard';
import { probeDatabase, SETUP_HINT } from './http/diagnostics';
import { etagFor, matchesEtag, NO_STORE } from './http/caching';
import { logMetric } from './observability/metrics';
import { D1CatalogStore } from './adapters/d1-catalog-store';
import { MalClient } from './source/mal-client';
import { UserService } from './services/user.service';
import { AnimeService } from './services/anime.service';
import { MangaService } from './services/manga.service';
import { CharacterService } from './services/character.service';
import { ProducerService } from './services/producer.service';
import { ClubService } from './services/club.service';
import { PersonService } from './services/person.service';
import { WatchService } from './services/watch.service';
import { RecommendationService } from './services/recommendation.service';
import { ReviewService } from './services/review.service';
import { SearchService } from './services/search.service';

const app: App = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  c.set('startedAt', performance.now());
  // Public read-only API: CORS is fully open. Abuse control lives in the rate limiter, not here.
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  // Rate limits are keyed by client IP GLOBALLY (not per route) — a per-route key would let a
  // single IP multiply its budget by the number of routes. Two windows, mirroring Jikan's own
  // published policy: a short burst window plus a per-minute ceiling.
  const client = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const burst = c.env?.API_BURST_LIMIT ? await c.env.API_BURST_LIMIT.limit({ key: client }) : { success: true };
  const sustained =
    burst.success && c.env?.API_RATE_LIMIT
      ? await c.env.API_RATE_LIMIT.limit({ key: client })
      : { success: burst.success };
  if (!burst.success || !sustained.success) {
    logMetric({
      route: new URL(c.req.url).pathname,
      resourceType: 'http',
      cacheStatus: 'miss',
      stale: false,
      responseDurationMs: Math.round(performance.now() - c.get('startedAt')),
      refreshResult: 'rate_limited',
    });
    c.header('X-Request-Id', c.get('requestId'));
    c.header('X-Worker-Version', c.env?.WORKER_VERSION ?? 'local');
    c.header('X-Cache-Status', 'rate_limited');
    c.header('Retry-After', burst.success ? '60' : '10');
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId: c.get('requestId') } },
      429,
    );
  }
  await next();
  c.header('X-Request-Id', c.get('requestId'));
  c.header('X-Worker-Version', c.env?.WORKER_VERSION ?? 'local');
  if (!c.res.headers.has('X-Cache-Status')) c.header('X-Cache-Status', 'unknown');
  logMetric({
    route: new URL(c.req.url).pathname,
    resourceType: 'http',
    cacheStatus: 'miss',
    stale: false,
    responseDurationMs: Math.round(performance.now() - c.get('startedAt')),
    refreshResult: String(c.res.status),
    responseSizeBytes: Number(c.res.headers.get('content-length') ?? 0),
  });
});

// ETag + conditional GET, for every /v1 response. Registered here, ahead of the routes, because
// Hono composes middleware in registration order — the same ordering that once made the /health
// query guard dead code.
//
// The tag is a hash of the body actually sent, not of (key, fetchedAt): `meta.cached` flips from
// false to true between the refresh that produced a payload and every read after it, so a tag
// derived from cache bookkeeping would call two different bodies identical. Two cached reads of an
// unchanged resource ARE byte-identical — success responses carry no requestId — so the 304 path
// works exactly when it should.
//
// Worth it because the heavy routes are heavy: /v1/anime/21/characters is 1.13 MB, and without a
// validator a caller polling it re-downloads all of it every time even when nothing changed.
// Hashing costs a few ms on the largest body in the catalogue and nothing on a typical one.
app.use('/v1/*', async (c, next) => {
  await next();
  if (c.res.status !== 200 || c.res.headers.get('cache-control') === NO_STORE) return;
  const etag = await etagFor(await c.res.clone().arrayBuffer());
  if (matchesEtag(c.req.header('If-None-Match'), etag)) {
    const headers = new Headers(c.res.headers);
    headers.delete('Content-Length');
    headers.set('ETag', etag);
    c.res = new Response(null, { status: 304, headers });
    return;
  }
  c.res.headers.set('ETag', etag);
});

// Every /v1 route reads D1 before anything else, so a missing binding would 500 all 96 of them with
// no clue why. Checked up front rather than inferred from a downstream error message.
app.use('/v1/*', async (c, next) => {
  if (!c.env?.DB)
    return c.json(
      { error: { code: 'DATABASE_NOT_CONFIGURED', message: SETUP_HINT.not_configured, requestId: c.get('requestId') } },
      503,
    );
  await next();
});

// Per-route query validation, registered before the handlers so it runs first. Refuses any
// parameter the route does not honour instead of accepting it and doing nothing. This must also
// run before /health is registered below — Hono composes middleware in registration order, so a
// handler registered ahead of its guard never reaches it. /health used to be registered first,
// which made its entry in QUERY_CONTRACT dead: `GET /health?bogus=1` answered 200 instead of 400.
registerQueryGuards(app);

// `status` answers "is the Worker up"; `checks.database` answers "is this deploy actually usable".
// Keeping the status code at 200 for a degraded database is deliberate: uptime monitors watch this
// route, and a self-hoster needs the diagnosis in the body, not a second failure to interpret.
app.get('/health', async (c) =>
  c.json({
    data: { status: 'ok', service: 'jikan-edge', checks: { database: await probeDatabase(c.env?.DB) } },
    meta: { requestId: c.get('requestId') },
  }),
);

function service(c: AppContext): UserService {
  return new UserService(c.env.DB, configFrom(c.env), undefined, background(c));
}
// The first factory that hands over built adapters instead of a raw binding — the shape the other
// eleven take in slice 3. `configFrom` is read once and shared: the source needs it for its timeout
// and user agent, the service for its TTLs.
function animeService(c: AppContext): AnimeService {
  const config = configFrom(c.env);
  return new AnimeService(new D1CatalogStore(c.env.DB), new MalClient(config), config, background(c));
}
function mangaService(c: AppContext): MangaService {
  return new MangaService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function characterService(c: AppContext): CharacterService {
  return new CharacterService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function producerService(c: AppContext): ProducerService {
  return new ProducerService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function clubService(c: AppContext): ClubService {
  return new ClubService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function personService(c: AppContext): PersonService {
  return new PersonService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function watchService(c: AppContext): WatchService {
  return new WatchService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function recommendationService(c: AppContext): RecommendationService {
  return new RecommendationService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function reviewService(c: AppContext): ReviewService {
  return new ReviewService(c.env.DB, configFrom(c.env), undefined, background(c));
}
function searchService(c: AppContext): SearchService {
  return new SearchService(c.env.DB, configFrom(c.env), undefined, background(c));
}

// Routes live one module per resource. Registration order does not matter for these — Hono
// matches on path, and the middleware that does depend on order is all registered above.
registerUsersRoutes(app, { service, searchService });
registerAnimeRoutes(app, { animeService, searchService });
registerSeasonsRoutes(app, { animeService });
registerMangaRoutes(app, { mangaService, searchService });
registerCharactersRoutes(app, { characterService, searchService });
registerProducersRoutes(app, { producerService });
registerClubsRoutes(app, { clubService });
registerPeopleRoutes(app, { personService, searchService });
registerWatchRoutes(app, { watchService });
registerRecommendationsRoutes(app, { recommendationService });
registerReviewsRoutes(app, { reviewService });
registerRandomRoutes(app, { service });

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: c.get('requestId') } }, 404),
);
export default app;
