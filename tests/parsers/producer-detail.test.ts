import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProducerDetail } from '../../src/parsers/producer-detail.parser';

const html = readFileSync('tests/fixtures/producers/detail-valid.html', 'utf8');

describe('producer detail parser', () => {
  it('normalizes a public producer detail page', () => {
    const detail = parseProducerDetail(html, 123, '2026-07-26T00:00:00.000Z');
    expect(detail.name).toBe('Victor Entertainment');
    expect(detail.imageUrl).toContain('company_logos');
    expect(detail.established).toBe('Apr 25, 1972');
    expect(detail.favorites).toBe(21);
  });
});
