import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyHtml } from '../../src/source/response-validator';

const metadata = { url: 'https://myanimelist.net/profile/a', status: 200, contentType: 'text/html; charset=UTF-8', durationMs: 1, sizeBytes: 600 };
const validBody = `<html><body>${'valid profile '.repeat(60)} Profile Anime Stats</body></html>`;

// This module is the only thing standing between "we trust this response" and "we don't" for every
// one of the 96 routes — every kind classifyHtml can return needs its own test, not just the two
// (challenge page, 404) it had before.
describe('response validator', () => {
  it('rejects challenge pages even with 200', () => expect(classifyHtml(readFileSync('tests/fixtures/users/suspicious.html', 'utf8'), metadata).kind).toBe('suspicious'));
  it('classifies missing profiles', () => expect(classifyHtml('', { ...metadata, status: 404 }).kind).toBe('not_found'));

  it('classifies a rate-limited response', () => {
    expect(classifyHtml('', { ...metadata, status: 429 }).kind).toBe('rate_limited');
  });

  it('classifies unauthorized and forbidden as private, the same as MAL hiding a profile', () => {
    expect(classifyHtml('', { ...metadata, status: 401 }).kind).toBe('private');
    expect(classifyHtml('', { ...metadata, status: 403 }).kind).toBe('private');
  });

  it('classifies a network-level failure with no status as an upstream error', () => {
    expect(classifyHtml('', { ...metadata, status: null }).kind).toBe('upstream_error');
  });

  it('classifies a 5xx as an upstream error, not suspicious', () => {
    expect(classifyHtml('', { ...metadata, status: 500 }).kind).toBe('upstream_error');
    expect(classifyHtml('', { ...metadata, status: 503 }).kind).toBe('upstream_error');
  });

  it('classifies a status outside 2xx/404/429/401/403/5xx as an upstream error', () => {
    expect(classifyHtml('', { ...metadata, status: 100 }).kind).toBe('upstream_error');
  });

  it('rejects a non-HTML content type even on a 200 with a plausible body', () => {
    const result = classifyHtml(validBody, { ...metadata, contentType: 'application/json' });
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'unexpected_content_type' });
  });

  it('rejects a body too short to be a real page', () => {
    const result = classifyHtml('too short', metadata);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'document_too_small' });
  });

  it('rejects a response missing a marker the caller said this page must have', () => {
    const result = classifyHtml(validBody, metadata, ['Something Not On This Page']);
    expect(result).toMatchObject({ kind: 'suspicious', reason: 'required_structure_missing' });
  });

  it('accepts a plausible HTML response that has every required marker', () => {
    const result = classifyHtml(validBody, metadata, ['Profile', 'Anime Stats']);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.value).toBe(validBody);
  });
});
