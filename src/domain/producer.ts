export interface ProducerDetail {
  malId: number;
  name: string;
  imageUrl: string | null;
  established: string | null;
  favorites: number | null;
  fetchedAt: string;
}

export const PRODUCER_PARSER_VERSION = 'producer-html-v1';
