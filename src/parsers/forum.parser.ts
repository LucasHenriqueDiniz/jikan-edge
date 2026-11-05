import { z } from 'zod';
import type { ForumThread } from '../domain/forum';
import { decodeHtml, numeric, ParserError } from './html';

export const threadSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(1),
  startedBy: z.string().nullable(),
  startedDate: z.string().nullable(),
  replies: z.number().nullable(),
  lastPostBy: z.string().nullable(),
});

// The same notice on anime and manga (measured 2026-11-05 on anime 38099 and manga 175006).
const NO_TOPICS = /No discussion topic was found\./;

export function parseForum(html: string): ForumThread[] {
  const threads: ForumThread[] = [];
  const blocks = html.split('data-topic-id="').slice(1);
  for (const block of blocks) {
    const idMatch = block.match(/^(\d+)"/);
    if (!idMatch) continue;
    const topicId = Number(idMatch[1]);
    const titleMatch = block.match(/href="\/forum\/\?topicid=\d+"[^>]*>([^<]+)<\/a>/i);
    if (!titleMatch) continue;
    const title = decodeHtml(titleMatch[1]);
    const startedBy = block.match(/forum_postusername"><a href="\/profile\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? null;
    const startedDate = block.match(/<span class="lightLink">([^<]+)<\/span>/i)?.[1] ?? null;
    const replies = numeric(block.match(/class="forum_boardrow2"[^>]*>\s*(\d+)\s*<\/td>/i)?.[1] ?? null);
    const lastPostBy = block.match(/>by <a href="\/profile\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? null;
    const candidate = {
      topicId,
      title,
      startedBy: startedBy ? decodeHtml(startedBy) : null,
      startedDate: startedDate ? decodeHtml(startedDate) : null,
      replies,
      lastPostBy: lastPostBy ? decodeHtml(lastPostBy) : null,
    };
    const parsed = threadSchema.safeParse(candidate);
    if (parsed.success) threads.push(parsed.data);
  }
  const emptyIsValid = blocks.length === 0 && NO_TOPICS.test(html);
  if (threads.length === 0 && !emptyIsValid) throw new ParserError('empty_forum_page');
  return threads;
}
