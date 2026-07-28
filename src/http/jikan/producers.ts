import type { ProducerDetail } from '../../domain/producer';
import type { ProducerFull } from '../../domain/producer-full';
import type { ProducerListEntry } from '../../domain/producer-list';
import { images, malUrl } from './primitives';

export function producerDetail(d: ProducerDetail) {
  return {
    mal_id: d.malId,
    url: malUrl('producer', d.malId),
    titles: [{ type: 'Default', title: d.name }],
    images: images(d.imageUrl),
    favorites: d.favorites,
    established: d.established,
    about: null,
    count: null,
    external: [],
  };
}

export function producerFull(d: ProducerFull) {
  return { ...producerDetail(d), about: d.about, external: d.external };
}

export function producerList(rows: ProducerListEntry[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    url: row.url,
    titles: [{ type: 'Default', title: row.name }],
    images: images(null),
    count: row.count,
    favorites: null,
    established: null,
  }));
}
