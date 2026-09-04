import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { AnimeRepository } from '../repositories/anime.repository';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';

/**
 * The D1 adapter for the store port: the one place that turns a `D1Database` binding into the
 * conversation a service is allowed to have.
 *
 * It composes the existing repositories rather than absorbing their SQL. They already hold the
 * statements, the column mapping and the `SQLITE_TOOBIG` behaviour the tests pin down.
 *
 * The `implements` clause here is the only conformance check, and the repositories carry none of
 * their own. Not an omission: `implements CatalogStore['cacheEntries']` is not legal TypeScript —
 * the clause takes an identifier, not an indexed access type — and exporting a named alias per
 * member to satisfy it would put four more interfaces on the port's public surface, which is the
 * twelve-interface shape the ADR rejected arriving by another route. A repository that drifts from
 * the contract still fails to compile; it fails here, naming the member that no longer fits.
 *
 * Construction still happens per request, which is what it was before: a D1 binding is a handle,
 * not a connection pool, so there is nothing to reuse across requests and nothing to tear down.
 */
export class D1CatalogStore implements CatalogStore {
  readonly cacheEntries: CacheRepository;
  readonly refreshLeases: RefreshLockRepository;
  readonly anime: AnimeRepository;
  readonly catalogLists: CatalogListRepository;

  constructor(db: D1Database) {
    this.cacheEntries = new CacheRepository(db);
    this.refreshLeases = new RefreshLockRepository(db);
    this.anime = new AnimeRepository(db);
    this.catalogLists = new CatalogListRepository(db);
  }
}
