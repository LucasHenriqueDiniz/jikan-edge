// Builds the OpenAPI document from the three sources of truth this repo already enforces: the routes
// Hono actually registers, QUERY_CONTRACT for what each one accepts, and ROUTE_DATA for what each
// one answers. Nothing about a route is written twice.
//
// It runs inside vitest, not at deploy: Workers Builds publishes the commit and this repo has no
// build step, so the document is a committed file (`site/openapi.json`) that a test regenerates and
// compares. Generating it per request was measured at 14-15 ms of CPU cold — over the Free plan's
// 10 ms — for a document that only changes when the code does.
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import app from '../../src/app';
import { QUERY_CONTRACT, UNSUPPORTED_PARAMS } from '../../src/http/query-contract';
import { HEALTH_DATA, ROUTE_DATA } from './route-schemas';

extendZodWithOpenApi(z);

export function registeredGetRoutes(): string[] {
  return [...new Set(app.routes.filter((route) => route.method === 'GET').map((route) => route.path))].filter(
    (path) => path === '/health' || path.startsWith('/v1/'),
  );
}

const openApiPath = (path: string) => path.replace(/:([A-Za-z]+)/g, '{$1}');

// `/v1/anime/:id/episodes` → `getAnimeByIdEpisodes`: unique because the path is, and stable because
// it is derived rather than chosen.
function operationId(path: string): string {
  const words = path
    .split('/')
    .filter((segment) => segment && segment !== 'v1')
    .map((segment) => (segment.startsWith(':') ? `by-${segment.slice(1)}` : segment))
    .flatMap((segment) => segment.split(/[-_]/));
  return `get${words.map((word) => word[0].toUpperCase() + word.slice(1)).join('')}`;
}

// The first segment after `/v1/` is the route group, the same grouping docs/routes.md uses.
const tagOf = (path: string) => (path === '/health' ? 'health' : path.split('/')[2]);

export function buildDocument() {
  const registry = new OpenAPIRegistry();
  const pagination = registry.register(
    'Pagination',
    z.object({
      page: z.number().int(),
      limit: z.number().int(),
      count: z.number().int(),
      total: z.number().int().nullable().openapi({ description: 'Only the user lists know a total; null elsewhere.' }),
      hasNextPage: z.boolean(),
    }),
  );
  const meta = registry.register(
    'Meta',
    z.object({
      cached: z.boolean(),
      stale: z
        .boolean()
        .openapi({ description: 'The payload outlived its TTL and is being served while it refreshes.' }),
      refreshFailed: z.boolean(),
      fetchedAt: z.string().openapi({ description: 'When the payload was read from MyAnimeList.' }),
      pagination: pagination.optional(),
    }),
  );
  const error = registry.register(
    'Error',
    z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }) }),
  );

  for (const path of registeredGetRoutes()) {
    const data = path === '/health' ? HEALTH_DATA : ROUTE_DATA[path];
    if (!data) throw new Error(`no response schema for ${path} in tests/openapi/route-schemas.ts`);
    const query = QUERY_CONTRACT[path] ?? [];
    const pathParams = [...path.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]);
    registry.registerPath({
      method: 'get',
      path: openApiPath(path),
      operationId: operationId(path),
      summary: `GET ${openApiPath(path)}`,
      tags: [tagOf(path)],
      request: {
        params:
          pathParams.length > 0
            ? z.object(Object.fromEntries(pathParams.map((name) => [name, z.string()])))
            : undefined,
        query:
          query.length > 0
            ? z.object(Object.fromEntries(query.map((name) => [name, z.string().optional()])))
            : undefined,
      },
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema:
                path === '/health'
                  ? z.object({ data, meta: z.object({ requestId: z.string() }) })
                  : z.object({ data, meta }),
            },
          },
        },
        default: {
          description: 'Any error, with a machine-readable code.',
          content: { 'application/json': { schema: error } },
        },
      },
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'jikan-edge',
      version: 'v1',
      description:
        'Public MyAnimeList data over HTTP, read from the public pages on demand and cached in D1. ' +
        'A parameter a route does not declare is a 400: UNKNOWN_PARAMETER for a name that does not exist, ' +
        'UNSUPPORTED_PARAMETER for one Jikan v4 has and this API does not honour (see x-unsupported-parameters).',
    },
    servers: [{ url: 'https://jikan.lucashdo.com' }],
    // Public: no route takes credentials. Declared rather than left out, so a client generator does not
    // have to guess.
    security: [],
    // Not real parameters — refused everywhere they are not declared — but worth publishing with the
    // reason, which is what someone porting from Jikan needs.
    'x-unsupported-parameters': UNSUPPORTED_PARAMS,
  } as Parameters<OpenApiGeneratorV31['generateDocument']>[0]);
}
