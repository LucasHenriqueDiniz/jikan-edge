import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyHtml } from '../../src/source/response-validator';

const metadata = { url: 'https://myanimelist.net/profile/a', status: 200, contentType: 'text/html; charset=UTF-8', durationMs: 1, sizeBytes: 600 };
describe('response validator', () => {
  it('rejects challenge pages even with 200', () => expect(classifyHtml(readFileSync('tests/fixtures/users/suspicious.html', 'utf8'), metadata).kind).toBe('suspicious'));
  it('classifies missing profiles', () => expect(classifyHtml('', { ...metadata, status: 404 }).kind).toBe('not_found'));
});
