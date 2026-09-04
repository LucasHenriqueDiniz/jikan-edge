/**
 * Which entity kinds a random pick can draw from. Lives in the domain rather than in
 * `random.service.ts`, where it used to be derived from the service's own table-name map: the port
 * and the repository both name it now, and neither should have to import a service to do so.
 */
export const RANDOM_KINDS = ['anime', 'manga', 'characters', 'people'] as const;
export type RandomKind = (typeof RANDOM_KINDS)[number];
