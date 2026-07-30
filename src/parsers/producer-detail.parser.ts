import { z } from 'zod';
import type { ProducerDetail } from '../domain/producer';
import { canonicalUrl, capture, COMPANY_LOGO_IMAGE, labelValue, numeric, ParserError, taggedImage } from './html';

const producerDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  name: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  established: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
});

export function parseProducerDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): ProducerDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const detail: ProducerDetail = {
    malId,
    url: canonicalUrl(head),
    name: name ?? '',
    imageUrl: taggedImage(head, COMPANY_LOGO_IMAGE),
    established: labelValue(head, 'Established'),
    favorites: numeric(labelValue(head, 'Member Favorites')),
    fetchedAt,
  };
  const validated = producerDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_producer_detail');
  return validated.data;
}
