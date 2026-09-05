import type { RandomKind } from '../domain/random';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { ServiceError } from './cacheable';

export type { RandomKind };

// Random draws only from entities already persisted in D1 by previous requests — MAL has no
// public "random" page, so this is a deliberate local-catalog policy (documented in docs/routes.md),
// not full-database randomness like upstream Jikan.
//
// It was the only service that took a raw database binding and wrote SQL against it, which is also
// why it was the only one with no factory in `src/app.ts` — the two route handlers built it inline.
// The SQL is now `RandomRepository` behind the store port; what stayed here is the policy: an empty
// local catalog is a 404, not an empty result.
//
// Neither the binding's type name nor any adapter constructor is spelled out above, on purpose.
// Slice 3's gate greps `src/services/` for both, and a gate that matches text cannot tell a comment
// from code. Slice 2 hit this from the other side and left a note asking slice 3 to end with no
// adapter class name anywhere, comments included; the first draft of *this* comment named the two
// it was warning about and failed the gate on a file that was already correct.
export class RandomService {
  constructor(private readonly store: CatalogStore) {}

  async pick(kind: RandomKind): Promise<{ data: unknown; fetchedAt: string }> {
    const picked = await this.store.randomPicks.pick(kind);
    if (!picked)
      throw new ServiceError(
        'NO_LOCAL_ENTRIES',
        404,
        `No ${kind} entries cached locally yet; fetch some detail pages first.`,
      );
    return picked;
  }

  async pickUser(): Promise<{ username: string }> {
    const picked = await this.store.randomPicks.pickUser();
    if (!picked) throw new ServiceError('NO_LOCAL_ENTRIES', 404, 'No user profiles cached locally yet.');
    return picked;
  }
}
