// Declared in `catalog-source.port.ts`, which owns the contract. Re-exported here so the adapter,
// the validator and the tests that import them from this module keep resolving.
export type { SourceMetadata, SourceResult } from '../ports/driven/catalog-source.port';
