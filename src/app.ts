import { Hono, type Context } from 'hono';
import { configFrom, type Env } from './config/env';
import { errorResponse } from './http/errors';
import { registerQueryGuards } from './http/query-guard';
import { probeDatabase, SETUP_HINT } from './http/diagnostics';
import { success } from './http/response';
import { paginationMeta, parseLimitParam } from './domain/pagination';
import { CLUB_LIST_PAGE_SIZE, CLUB_MEMBERS_PAGE_SIZE, RECOMMENDATIONS_PAGE_SIZE, REVIEWS_PAGE_SIZE, SEARCH_PAGE_SIZE, TITLE_REVIEWS_PAGE_SIZE, TOP_PAGE_SIZE, USER_SEARCH_PAGE_SIZE } from './source/mal-urls';
import { logMetric } from './observability/metrics';
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
import { RandomService, type RandomKind } from './services/random.service';

type Variables = { requestId: string; startedAt: number; page: number };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID()); c.set('startedAt', performance.now());
  // Public read-only API: CORS is fully open. Abuse control lives in the rate limiter, not here.
  c.header('Access-Control-Allow-Origin', '*'); c.header('Access-Control-Allow-Methods', 'GET, OPTIONS'); c.header('Access-Control-Allow-Headers', 'Content-Type');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  // Rate limits are keyed by client IP GLOBALLY (not per route) — a per-route key would let a
  // single IP multiply its budget by the number of routes. Two windows, mirroring Jikan's own
  // published policy: a short burst window plus a per-minute ceiling.
  const client = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const burst = c.env?.API_BURST_LIMIT ? await c.env.API_BURST_LIMIT.limit({ key: client }) : { success: true };
  const sustained = burst.success && c.env?.API_RATE_LIMIT ? await c.env.API_RATE_LIMIT.limit({ key: client }) : { success: burst.success };
  if (!burst.success || !sustained.success) {
    logMetric({ route: new URL(c.req.url).pathname, resourceType: 'http', cacheStatus: 'miss', stale: false, responseDurationMs: Math.round(performance.now() - c.get('startedAt')), refreshResult: 'rate_limited' });
    c.header('X-Request-Id', c.get('requestId')); c.header('X-Worker-Version', c.env?.WORKER_VERSION ?? 'local'); c.header('X-Cache-Status', 'rate_limited');
    c.header('Retry-After', burst.success ? '60' : '10');
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId: c.get('requestId') } }, 429);
  }
  await next();
  c.header('X-Request-Id', c.get('requestId'));
  c.header('X-Worker-Version', c.env?.WORKER_VERSION ?? 'local');
  if (!c.res.headers.has('X-Cache-Status')) c.header('X-Cache-Status', 'unknown');
  logMetric({ route: new URL(c.req.url).pathname, resourceType: 'http', cacheStatus: 'miss', stale: false, responseDurationMs: Math.round(performance.now() - c.get('startedAt')), refreshResult: String(c.res.status), responseSizeBytes: Number(c.res.headers.get('content-length') ?? 0) });
});

// `status` answers "is the Worker up"; `checks.database` answers "is this deploy actually usable".
// Keeping the status code at 200 for a degraded database is deliberate: uptime monitors watch this
// route, and a self-hoster needs the diagnosis in the body, not a second failure to interpret.
app.get('/health', async (c) => c.json({ data: { status: 'ok', service: 'jikan-edge', checks: { database: await probeDatabase(c.env?.DB) } }, meta: { requestId: c.get('requestId') } }));

// Every /v1 route reads D1 before anything else, so a missing binding would 500 all 96 of them with
// no clue why. Checked up front rather than inferred from a downstream error message.
app.use('/v1/*', async (c, next) => {
  if (!c.env?.DB) return c.json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: SETUP_HINT.not_configured, requestId: c.get('requestId') } }, 503);
  await next();
});

// Per-route query validation, registered before the handlers so it runs first. Refuses any
// parameter the route does not honour instead of accepting it and doing nothing.
registerQueryGuards(app);

function service(c: Context<{ Bindings: Env; Variables: Variables }>): UserService { return new UserService(c.env.DB, configFrom(c.env)); }
function animeService(c: Context<{ Bindings: Env; Variables: Variables }>): AnimeService { return new AnimeService(c.env.DB, configFrom(c.env)); }
function mangaService(c: Context<{ Bindings: Env; Variables: Variables }>): MangaService { return new MangaService(c.env.DB, configFrom(c.env)); }
function characterService(c: Context<{ Bindings: Env; Variables: Variables }>): CharacterService { return new CharacterService(c.env.DB, configFrom(c.env)); }
function producerService(c: Context<{ Bindings: Env; Variables: Variables }>): ProducerService { return new ProducerService(c.env.DB, configFrom(c.env)); }
function clubService(c: Context<{ Bindings: Env; Variables: Variables }>): ClubService { return new ClubService(c.env.DB, configFrom(c.env)); }
function personService(c: Context<{ Bindings: Env; Variables: Variables }>): PersonService { return new PersonService(c.env.DB, configFrom(c.env)); }
function watchService(c: Context<{ Bindings: Env; Variables: Variables }>): WatchService { return new WatchService(c.env.DB, configFrom(c.env)); }
function recommendationService(c: Context<{ Bindings: Env; Variables: Variables }>): RecommendationService { return new RecommendationService(c.env.DB, configFrom(c.env)); }
function reviewService(c: Context<{ Bindings: Env; Variables: Variables }>): ReviewService { return new ReviewService(c.env.DB, configFrom(c.env)); }
function searchService(c: Context<{ Bindings: Env; Variables: Variables }>): SearchService { return new SearchService(c.env.DB, configFrom(c.env)); }
function cacheHeader(c: Context<{ Bindings: Env; Variables: Variables }>, result: { cached: boolean; stale: boolean }): void { c.header('X-Cache-Status', result.stale ? 'stale' : result.cached ? 'hit' : 'miss'); }

app.get('/v1/users/:username', async (c) => {
  try { const result = await service(c).profile(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/statistics', async (c) => {
  try { const result = await service(c).statistics(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/favorites', async (c) => {
  try { const result = await service(c).favoritesFor(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/userupdates', async (c) => {
  try { const result=await service(c).userUpdates(c.req.param('username'), c.get('requestId')); cacheHeader(c,result); return c.json(success(result.data,{cached:result.cached,stale:result.stale,refreshFailed:result.refreshFailed,fetchedAt:result.fetchedAt})); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/full', async (c) => {
  try { const result = await service(c).fullProfile(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/about', async (c) => {
  try { const result = await service(c).about(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/friends', async (c) => {
  try { const result = await service(c).friends(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/clubs', async (c) => {
  try { const result = await service(c).clubs(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/reviews', async (c) => {
  try { const result = await service(c).reviews(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/users/:username/recommendations', async (c) => {
  try { const result = await service(c).recommendations(c.req.param('username'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
for (const mediaType of ['anime', 'manga'] as const) app.get(`/v1/users/:username/${mediaType}list`, async (c) => {
  try {
    const page = c.get('page');
    const limit = parseLimitParam(c.req.query('limit'));
    const result = await service(c).mediaList(c.req.param('username'), mediaType, c.get('requestId'), page, limit);
    cacheHeader(c, result);
    // The only routes with a real `total`: these page over D1, not over a MyAnimeList page.
    return c.json(success(result.data.entries, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(page, limit, result.data.entries.length, result.data.total) }));
  } catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/users', async (c) => {
  try { const result = await searchService(c).users(c.req.query('q'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), USER_SEARCH_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/anime', async (c) => {
  try { const filters = { type: c.req.query('type'), status: c.req.query('status'), rating: c.req.query('rating'), score: c.req.query('score'), minScore: c.req.query('min_score'), genres: c.req.query('genres'), genresExclude: c.req.query('genres_exclude'), orderBy: c.req.query('order_by'), sort: c.req.query('sort'), letter: c.req.query('letter'), startDate: c.req.query('start_date'), endDate: c.req.query('end_date') }; const result = await searchService(c).anime(c.req.query('q'), c.get('page'), filters, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), SEARCH_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id', async (c) => {
  try { const result = await animeService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/full', async (c) => {
  try { const result = await animeService(c).full(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/relations', async (c) => {
  try { const result = await animeService(c).relations(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/external', async (c) => {
  try { const result = await animeService(c).externalLinks(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/streaming', async (c) => {
  try { const result = await animeService(c).streaming(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/characters', async (c) => {
  try { const result = await animeService(c).characters(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/staff', async (c) => {
  try { const result = await animeService(c).staff(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/statistics', async (c) => {
  try { const result = await animeService(c).statistics(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/pictures', async (c) => {
  try { const result = await animeService(c).pictures(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/news', async (c) => {
  try { const result = await animeService(c).news(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/forum', async (c) => {
  try { const result = await animeService(c).forum(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/episodes', async (c) => {
  try { const result = await animeService(c).episodes(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/recommendations', async (c) => {
  try { const result = await animeService(c).recommendations(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/reviews', async (c) => {
  try { const result = await animeService(c).reviews(c.req.param('id'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TITLE_REVIEWS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/videos', async (c) => {
  try { const result = await animeService(c).videos(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/videos/episodes', async (c) => {
  try { const result = await animeService(c).videosEpisodes(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/episodes/:episode', async (c) => {
  try { const result = await animeService(c).episodeDetail(c.req.param('id'), c.req.param('episode'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/userupdates', async (c) => {
  try { const result = await animeService(c).userUpdates(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/themes', async (c) => {
  try { const result = await animeService(c).themes(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/anime/:id/moreinfo', async (c) => {
  try { const result = await animeService(c).moreInfo(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/genres/anime', async (c) => {
  try { const result = await animeService(c).genres(c.req.query('filter'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/top/anime', async (c) => {
  try { const result = await animeService(c).topAnime(c.get('page'), c.req.query('filter'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TOP_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/seasons', async (c) => {
  try { const result = await animeService(c).seasonArchive(c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/seasons/now', async (c) => {
  try { const result = await animeService(c).seasonNow(c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/seasons/upcoming', async (c) => {
  try { const result = await animeService(c).seasonUpcoming(c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/seasons/:year/:season', async (c) => {
  try { const result = await animeService(c).seasonByYear(c.req.param('year'), c.req.param('season'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/manga', async (c) => {
  try { const filters = { type: c.req.query('type'), status: c.req.query('status'), score: c.req.query('score'), minScore: c.req.query('min_score'), genres: c.req.query('genres'), genresExclude: c.req.query('genres_exclude'), orderBy: c.req.query('order_by'), sort: c.req.query('sort'), letter: c.req.query('letter'), startDate: c.req.query('start_date'), endDate: c.req.query('end_date') }; const result = await searchService(c).manga(c.req.query('q'), c.get('page'), filters, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), SEARCH_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id', async (c) => {
  try { const result = await mangaService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/full', async (c) => {
  try { const result = await mangaService(c).full(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/relations', async (c) => {
  try { const result = await mangaService(c).relations(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/external', async (c) => {
  try { const result = await mangaService(c).externalLinks(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/characters', async (c) => {
  try { const result = await mangaService(c).characters(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/statistics', async (c) => {
  try { const result = await mangaService(c).statistics(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/pictures', async (c) => {
  try { const result = await mangaService(c).pictures(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/news', async (c) => {
  try { const result = await mangaService(c).news(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/forum', async (c) => {
  try { const result = await mangaService(c).forum(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/recommendations', async (c) => {
  try { const result = await mangaService(c).recommendations(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/reviews', async (c) => {
  try { const result = await mangaService(c).reviews(c.req.param('id'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TITLE_REVIEWS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/userupdates', async (c) => {
  try { const result = await mangaService(c).userUpdates(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/manga/:id/moreinfo', async (c) => {
  try { const result = await mangaService(c).moreInfo(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/genres/manga', async (c) => {
  try { const result = await mangaService(c).genres(c.req.query('filter'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/top/manga', async (c) => {
  try { const result = await mangaService(c).topManga(c.get('page'), c.req.query('filter'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TOP_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/top/people', async (c) => {
  try { const result = await personService(c).topPeople(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TOP_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/top/characters', async (c) => {
  try { const result = await characterService(c).topCharacters(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), TOP_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/characters', async (c) => {
  try { const result = await searchService(c).characters(c.req.query('q'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), SEARCH_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id', async (c) => {
  try { const result = await characterService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id/full', async (c) => {
  try { const result = await characterService(c).full(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id/anime', async (c) => {
  try { const result = await characterService(c).anime(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id/manga', async (c) => {
  try { const result = await characterService(c).manga(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id/voices', async (c) => {
  try { const result = await characterService(c).voices(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/characters/:id/pictures', async (c) => {
  try { const result = await characterService(c).pictures(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/producers', async (c) => {
  try { const result = await producerService(c).list(c.req.query('q'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/producers/:id', async (c) => {
  try { const result = await producerService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/producers/:id/full', async (c) => {
  try { const result = await producerService(c).full(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/producers/:id/external', async (c) => {
  try { const result = await producerService(c).external(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/clubs', async (c) => {
  try { const result = await clubService(c).list(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), CLUB_LIST_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/clubs/:id', async (c) => {
  try { const result = await clubService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/clubs/:id/staff', async (c) => {
  try { const result = await clubService(c).staff(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/clubs/:id/relations', async (c) => {
  try { const result = await clubService(c).relations(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/clubs/:id/members', async (c) => {
  try { const result = await clubService(c).members(c.req.param('id'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), CLUB_MEMBERS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/people', async (c) => {
  try { const result = await searchService(c).people(c.req.query('q'), c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), SEARCH_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id', async (c) => {
  try { const result = await personService(c).detail(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/full', async (c) => {
  try { const result = await personService(c).full(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/anime', async (c) => {
  try { const result = await personService(c).anime(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/manga', async (c) => {
  try { const result = await personService(c).manga(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/voices', async (c) => {
  try { const result = await personService(c).voices(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/pictures', async (c) => {
  try { const result = await personService(c).pictures(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/people/:id/news', async (c) => {
  try { const result = await personService(c).news(c.req.param('id'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/watch/episodes', async (c) => {
  try { const result = await watchService(c).episodes(false, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/watch/episodes/popular', async (c) => {
  try { const result = await watchService(c).episodes(true, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/watch/promos', async (c) => {
  try { const result = await watchService(c).promos(false, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/watch/promos/popular', async (c) => {
  try { const result = await watchService(c).promos(true, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/recommendations/anime', async (c) => {
  try { const result = await recommendationService(c).anime(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), RECOMMENDATIONS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/recommendations/manga', async (c) => {
  try { const result = await recommendationService(c).manga(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), RECOMMENDATIONS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.get('/v1/reviews/anime', async (c) => {
  try { const result = await reviewService(c).anime(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), REVIEWS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/reviews/manga', async (c) => {
  try { const result = await reviewService(c).manga(c.get('page'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt, pagination: paginationMeta(c.get('page'), REVIEWS_PAGE_SIZE, result.data.length) })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/magazines', async (c) => {
  try { const result = await mangaService(c).magazines(c.req.query('q'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/schedules', async (c) => {
  try { const result = await animeService(c).schedule(c.req.query('filter'), c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

for (const kind of ['anime', 'manga', 'characters', 'people'] as RandomKind[]) app.get(`/v1/random/${kind}`, async (c) => {
  try { const data = await new RandomService(c.env.DB).pick(kind); c.header('X-Cache-Status', 'local'); return c.json(success(data, {})); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});
app.get('/v1/random/users', async (c) => {
  try { const picked = await new RandomService(c.env.DB).pickUser(); const result = await service(c).profile(picked.username, c.get('requestId')); cacheHeader(c, result); return c.json(success(result.data, { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt })); }
  catch (error) { return errorResponse(c, error, c.get('requestId')); }
});

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: c.get('requestId') } }, 404));
export default app;
