import { describe, expect, it } from 'vitest';
import app from '../../src/app';

type ErrorBody = { error: { code: string; message: string; requestId: string } };

async function get(path: string) {
  const response = await app.request(`http://localhost${path}`);
  return { response, body: (await response.json()) as ErrorBody };
}

// `/v4/*` drew ~17.1k requests a day (2026-11-10 to 16), all answered a bare `Route not found.`:
// Jikan clients pointed at this host, told nothing about where the route lives or why it will not
// parse as Jikan's.
describe('a Jikan v4 path', () => {
  it('answers 404 with the /v1 path and the migration guide', async () => {
    const { response, body } = await get('/v4/anime/1');

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('not a drop-in replacement for Jikan v4');
    expect(body.error.message).toContain('(try /v1/anime/1)');
    expect(body.error.message).toContain('http://localhost/#migrate');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
  });

  it('covers the bare prefix too', async () => {
    const { body } = await get('/v4');
    expect(body.error.message).toContain('(try /v1)');
  });

  it('is told apart from a path that only starts with the same characters', async () => {
    const { body } = await get('/v4x/anime/1');
    expect(body.error.message).toBe('Route not found.');
  });
});

describe('a path no route answers', () => {
  it('says Route not found, and is marked as an error that nothing may cache', async () => {
    const { response, body } = await get('/nope');

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Route not found.' });
    expect(response.headers.get('x-cache-status')).toBe('error');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
