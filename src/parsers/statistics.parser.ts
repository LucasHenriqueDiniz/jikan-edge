import { z } from 'zod';
import type { EntryStatistics } from '../domain/statistics';
import { labelValue, numeric, ParserError } from './html';

const statusSchema = z.object({
  inProgress: z.number().nullable(), completed: z.number().nullable(), onHold: z.number().nullable(),
  dropped: z.number().nullable(), planned: z.number().nullable(), total: z.number().nullable(),
});
const scoreSchema = z.object({ score: z.number().int().min(1).max(10), votes: z.number().int().min(0), percentage: z.number() });
const statisticsSchema = z.object({ status: statusSchema, scores: z.array(scoreSchema), fetchedAt: z.string().datetime() });

function extractScores(html: string): { score: number; votes: number; percentage: number }[] {
  const scores: { score: number; votes: number; percentage: number }[] = [];
  for (const match of html.matchAll(/class="score-label score-(\d+)">\d+<\/td>\s*<td><div class="spaceit_pad"><div class="updatesBar" style="float: left; height: 15px; width: ([\d.]+)%;"><\/div><span>&nbsp;[\d.]+%\s*<small>\((\d+)\s*votes\)<\/small>/gi)) {
    scores.push({ score: Number(match[1]), percentage: Number(match[2]), votes: Number(match[3]) });
  }
  return scores.sort((a, b) => b.score - a.score);
}

export function parseStatistics(html: string, fetchedAt = new Date().toISOString()): EntryStatistics {
  const head = html.slice(0, 120_000);
  const statistics: EntryStatistics = {
    status: {
      inProgress: numeric(labelValue(head, 'Watching', 'Reading')),
      completed: numeric(labelValue(head, 'Completed')),
      onHold: numeric(labelValue(head, 'On-Hold')),
      dropped: numeric(labelValue(head, 'Dropped')),
      planned: numeric(labelValue(head, 'Plan to Watch', 'Plan to Read')),
      total: numeric(labelValue(head, 'Total')),
    },
    scores: extractScores(head),
    fetchedAt,
  };
  const validated = statisticsSchema.safeParse(statistics);
  if (!validated.success) throw new ParserError('invalid_statistics');
  return validated.data;
}
