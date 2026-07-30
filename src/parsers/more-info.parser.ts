import type { MoreInfo } from '../domain/more-info';
import { richText } from './html';

const HEADER = '<h2 class="mb8">More Info</h2>';

// Free-form curator notes (viewing order, prototype/related trivia, etc.) â€” most titles don't
// have any, so absence of the header is a normal, valid result, not a parse failure.
export function parseMoreInfo(html: string): MoreInfo {
  const start = html.indexOf(HEADER);
  if (start === -1) return { text: null };
  const contentStart = start + HEADER.length;
  const end = html.indexOf('<div style="padding: 20px', contentStart);
  const text = richText(html.slice(contentStart, end === -1 ? contentStart + 4_000 : end)) || null;
  return { text };
}
