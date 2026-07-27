import { describe, expect, it } from 'vitest';
import { MalClient } from '../../src/source/mal-client';

const config = { profileTtlSeconds: 1, listTtlSeconds: 1, animeTtlSeconds: 1, catalogTtlSeconds: 1, sourceTimeoutMs: 1000, maxUpstreamBytes: 10_000, malUserAgent: 'test', corsAllowedOrigins: [] };
const html = `<html><body>${'valid profile '.repeat(60)} Profile Anime Stats</body></html>`;

describe('MalClient redirects', () => {
  it('rejects a redirect outside the exact MAL host', async () => {
    const client = new MalClient(config, async () => new Response('', { status: 302, headers: { location: 'https://example.com/' } }));
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'redirect_host_not_allowed' });
  });
  it('accepts an allowed relative redirect', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 302, headers: { location: '/profile/a' } }) : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    });
    expect((await client.getHtml('https://myanimelist.net/profile/a', ['Profile'])).kind).toBe('success');
  });
});
