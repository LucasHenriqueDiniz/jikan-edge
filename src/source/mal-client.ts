import type { RuntimeConfig } from '../config/env';
import { classifyHtml } from './response-validator';
import type { SourceResult } from './source-types';

const MAL_HOST = 'myanimelist.net';

export class MalClient {
  constructor(private readonly config: RuntimeConfig, private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)) {}

  async getHtml(url: string, requiredMarkers: string[] = []): Promise<SourceResult<string>> {
    const parsed = new URL(url);
    if (!this.isAllowed(parsed)) {
      return { kind: 'suspicious', reason: 'host_not_allowed', metadata: { url, status: null, contentType: null, durationMs: 0, sizeBytes: 0 } };
    }
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.sourceTimeoutMs);
    try {
      let target = parsed;
      let response: Response | undefined;
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        response = await this.fetcher(target.toString(), {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': this.config.malUserAgent },
        redirect: 'manual',
        signal: controller.signal,
        });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get('location');
        if (!location) return { kind: 'suspicious', reason: 'redirect_without_location', metadata: { url, status: response.status, contentType: null, durationMs: Math.round(performance.now() - startedAt), sizeBytes: 0 } };
        target = new URL(location, target);
        if (!this.isAllowed(target)) return { kind: 'suspicious', reason: 'redirect_host_not_allowed', metadata: { url, status: response.status, contentType: null, durationMs: Math.round(performance.now() - startedAt), sizeBytes: 0 } };
      }
      if (!response || (response.status >= 300 && response.status < 400)) return { kind: 'suspicious', reason: 'too_many_redirects', metadata: { url, status: response?.status ?? null, contentType: null, durationMs: Math.round(performance.now() - startedAt), sizeBytes: 0 } };
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      const metadata = {
        url,
        status: response.status,
        contentType: response.headers.get('content-type'),
        durationMs: Math.round(performance.now() - startedAt),
        sizeBytes: contentLength,
      };
      if (contentLength > this.config.maxUpstreamBytes) return { kind: 'suspicious', reason: 'document_too_large', metadata };
      const body = await response.text();
      metadata.sizeBytes = new TextEncoder().encode(body).byteLength;
      if (metadata.sizeBytes > this.config.maxUpstreamBytes) return { kind: 'suspicious', reason: 'document_too_large', metadata };
      return classifyHtml(body, metadata, requiredMarkers);
    } catch (error) {
      const metadata = { url, status: null, contentType: null, durationMs: Math.round(performance.now() - startedAt), sizeBytes: 0 };
      console.warn(JSON.stringify({ type: 'source_fetch_failed', url, error: error instanceof Error ? error.message : 'unknown' }));
      return { kind: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'upstream_error', reason: 'fetch_failed', metadata };
    } finally {
      clearTimeout(timeout);
    }
  }

  private isAllowed(url: URL): boolean { return url.protocol === 'https:' && url.hostname === MAL_HOST; }
}
