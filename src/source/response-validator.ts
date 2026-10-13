import type { SourceMetadata, SourceResult } from './source-types';

const suspiciousMarkers = [/cf-chl/i, /access denied/i, /just a moment/i, /challenge-platform/i];

export function classifyHtml(
  body: string,
  metadata: SourceMetadata,
  requiredMarkers: string[] = [],
): SourceResult<string> {
  if (metadata.status === 404) return { kind: 'not_found', metadata };
  if (metadata.status === 429) return { kind: 'rate_limited', metadata };
  if (metadata.status === 401 || metadata.status === 403) return { kind: 'private', metadata };
  if (metadata.status === null || metadata.status >= 500) return { kind: 'upstream_error', metadata };
  if (metadata.status < 200 || metadata.status >= 300) return { kind: 'upstream_error', metadata };
  if (!metadata.contentType?.toLowerCase().includes('text/html'))
    return { kind: 'suspicious', reason: 'unexpected_content_type', metadata };
  if (body.trim().length < 512) return { kind: 'suspicious', reason: 'document_too_small', metadata };
  if (suspiciousMarkers.some((marker) => marker.test(body)))
    return { kind: 'suspicious', reason: 'challenge_or_login', metadata };
  // MAL's "no such id" page for characters comes back as a 200 — `<h1 class="h1">Invalid</h1>` over
  // `<div class="badresult">Invalid ID provided.</div>` — where the other entities answer 404. Left to
  // the marker check below it failed as `required_structure_missing` and reached the caller as a
  // 502, telling them MAL was misbehaving when the id simply does not exist.
  if (/<div class="badresult">\s*Invalid ID provided\./i.test(body)) return { kind: 'not_found', metadata };
  if (requiredMarkers.some((marker) => !body.includes(marker)))
    return { kind: 'suspicious', reason: 'required_structure_missing', metadata };
  return { kind: 'success', value: body, metadata };
}
