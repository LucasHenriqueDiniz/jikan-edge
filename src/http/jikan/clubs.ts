import type { ClubDetail, ClubStaffMember } from '../../domain/club';
import type { ClubListEntry } from '../../domain/club-list';
import type { ClubMember } from '../../domain/club-member';
import type { ClubRelations } from '../../parsers/club-relations.parser';
import { entity, images, malUrl } from './primitives';

export function clubDetail(d: ClubDetail) {
  return {
    mal_id: d.malId,
    name: d.title,
    url: malUrl('clubs', d.malId),
    images: images(null),
    members: d.members,
    category: d.category,
    created: d.created,
    access: null,
  };
}

export function clubStaff(rows: ClubStaffMember[]) {
  return rows.map((row) => ({ url: row.url, username: row.username, role: row.role }));
}

export function clubMembers(rows: ClubMember[]) {
  return rows.map((row) => ({ username: row.username, url: row.url, images: images(row.avatarUrl) }));
}

export function clubList(rows: ClubListEntry[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    name: row.title,
    url: malUrl('clubs', row.malId),
    images: images(row.imageUrl),
    members: row.members,
    description: row.description,
  }));
}

export function clubRelations(r: ClubRelations) {
  return {
    anime: r.anime.map((a) => entity('anime', a.malId, a.title)),
    manga: r.manga.map((m) => entity('manga', m.malId, m.title)),
    characters: r.characters.map((ch) => entity('character', ch.malId, ch.name)),
  };
}
