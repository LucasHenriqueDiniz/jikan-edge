import { z } from 'zod';
import type { Picture } from '../domain/picture';
import { ParserError } from './html';

const pictureSchema = z.object({ imageUrl: z.string().url(), thumbnailUrl: z.string().url().nullable() });

export function parsePictures(html: string): Picture[] {
  const pictures: Picture[] = [];
  for (const match of html.matchAll(/<a href="([^"]+)"[^>]*class="js-picture-gallery"[^>]*>\s*<img[^>]*data-src="([^"]+)"/gi)) {
    const parsed = pictureSchema.safeParse({ imageUrl: match[1], thumbnailUrl: match[2] });
    if (parsed.success) pictures.push(parsed.data);
  }
  if (pictures.length === 0) throw new ParserError('empty_pictures_page');
  return pictures;
}
