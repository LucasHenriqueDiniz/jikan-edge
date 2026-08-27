import { describe, expect, it } from 'vitest';
import { MalClient } from '../../src/source/mal-client';

const config = { profileTtlSeconds: 1, listTtlSeconds: 1, animeTtlSeconds: 1, catalogTtlSeconds: 1, sourceTimeoutMs: 1000, maxUpstreamBytes: 10_000, malUserAgent: 'test' };
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

// A cold cache miss (nothing stale to fall back to) used to mean a single transient network blip —
// a dropped connection, not MAL being genuinely down — turned into an immediate 503/504.
describe('MalClient retry', () => {
  it('retries once on a transient network error and returns the retry\'s outcome', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      if (calls === 1) throw new Error('ECONNRESET');
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    });
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result.kind).toBe('success');
    expect(calls).toBe(2);
  });

  it('retries once on a timeout, and gives up (not loops) if the retry also times out', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      throw new DOMException('Aborted', 'AbortError');
    });
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result.kind).toBe('timeout');
    expect(calls).toBe(2);
  });

  // The retry is worth it on the default budget, where an expiry plausibly means a blip. On an
  // extended budget it would double an already long wait — 40 s on the character-page budget —
  // for a low chance of recovery, and push past the 30 s grace period an in-flight request gets
  // during a runtime update.
  it('does not retry a timeout when the caller granted an extended budget', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      throw new DOMException('Aborted', 'AbortError');
    });
    const result = await client.getHtml('https://myanimelist.net/anime/21/x/characters', [], { timeoutMs: config.sourceTimeoutMs * 20 });
    expect(result.kind).toBe('timeout');
    expect(calls).toBe(1);
  });

  it('still retries a transient network error on an extended budget — that one fails fast', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      if (calls === 1) throw new Error('ECONNRESET');
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    });
    const result = await client.getHtml('https://myanimelist.net/anime/21/x/characters', ['Profile'], { timeoutMs: config.sourceTimeoutMs * 20 });
    expect(result.kind).toBe('success');
    expect(calls).toBe(2);
  });

  it('does not retry a deterministic upstream response like a 404', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      return new Response('', { status: 404 });
    });
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result.kind).toBe('not_found');
    expect(calls).toBe(1);
  });

  it('does not retry a suspicious classification — a retry would not change a challenge page', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      return new Response('too short to be a real page', { status: 200, headers: { 'content-type': 'text/html' } });
    });
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result.kind).toBe('suspicious');
    expect(calls).toBe(1);
  });
});

describe('MalClient redirect and size limits', () => {
  it('rejects a redirect response with no Location header', async () => {
    const client = new MalClient(config, async () => new Response('', { status: 302 }));
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'redirect_without_location' });
  });

  it('gives up after 4 redirects instead of following the chain forever', async () => {
    let calls = 0;
    const client = new MalClient(config, async () => {
      calls += 1;
      return new Response('', { status: 302, headers: { location: '/profile/a' } });
    });
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'too_many_redirects' });
    expect(calls).toBe(4);
  });

  // The character pages of long-running series run to 10 MB, an order of magnitude past what the
  // global limit is sized for. Rather than loosen it for all 96 routes, those routes ask.
  it('admits a body over the global limit when the caller raised maxBytes for that call', async () => {
    const oversized = `<html><body>${'x'.repeat(config.maxUpstreamBytes)} Profile Anime Stats</body></html>`;
    const client = new MalClient(config, async () => new Response(oversized, { status: 200, headers: { 'content-type': 'text/html' } }));
    expect((await client.getHtml('https://myanimelist.net/anime/21/x/characters', ['Profile'])).kind).toBe('suspicious');
    expect((await client.getHtml('https://myanimelist.net/anime/21/x/characters', ['Profile'], { maxBytes: config.maxUpstreamBytes * 4 })).kind).toBe('success');
  });

  it('still enforces the raised limit rather than making it unbounded', async () => {
    const huge = `<html><body>${'x'.repeat(config.maxUpstreamBytes * 5)} Profile Anime Stats</body></html>`;
    const client = new MalClient(config, async () => new Response(huge, { status: 200, headers: { 'content-type': 'text/html' } }));
    const result = await client.getHtml('https://myanimelist.net/anime/21/x/characters', ['Profile'], { maxBytes: config.maxUpstreamBytes * 4 });
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'document_too_large' });
  });

  it('rejects a response whose declared Content-Length exceeds the limit', async () => {
    const client = new MalClient(config, async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html', 'content-length': '20000' } }));
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'document_too_large' });
  });

  it('rejects an oversized body even when Content-Length under-reports it', async () => {
    const oversized = 'x'.repeat(config.maxUpstreamBytes + 1);
    const client = new MalClient(config, async () => new Response(oversized, { status: 200, headers: { 'content-type': 'text/html' } }));
    const result = await client.getHtml('https://myanimelist.net/profile/a', ['Profile']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'document_too_large' });
  });
});
