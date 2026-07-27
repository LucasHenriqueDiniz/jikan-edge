import { z } from 'zod';
import { PRODUCER_PARSER_VERSION, type ProducerDetail } from '../domain/producer';
import { capture, numeric, ParserError } from './html';

const producerDetailSchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  established: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
  sourceVersion: z.string(),
});

function plainLabelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
}

function extractImage(html: string): string | null {
  const tag = html.match(/<img[^>]*data-src="[^"]*company_logos[^"]*"[^>]*>/i)?.[0];
  return tag?.match(/\sdata-src="([^"]+)"/i)?.[1] ?? null;
}

export function parseProducerDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): ProducerDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const detail: ProducerDetail = {
    malId,
    name: name ?? '',
    imageUrl: extractImage(head),
    established: plainLabelValue(head, 'Established'),
    favorites: numeric(plainLabelValue(head, 'Member Favorites')),
    fetchedAt,
    sourceVersion: PRODUCER_PARSER_VERSION,
  };
  const validated = producerDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_producer_detail');
  return validated.data;
}
