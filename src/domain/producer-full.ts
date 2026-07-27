import type { ExternalLink } from './anime';
import type { ProducerDetail } from './producer';

export interface ProducerFull extends ProducerDetail {
  about: string | null;
  external: ExternalLink[];
}

export const PRODUCER_FULL_PARSER_VERSION = 'producer-full-html-v1';
