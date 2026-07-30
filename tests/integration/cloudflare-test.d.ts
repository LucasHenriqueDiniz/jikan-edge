// `cloudflare:test` is a virtual module the Workers vitest pool injects at run time, so `tsc` can
// only see it through the package's own declarations. Without this reference the integration tests
// had to be excluded from the typecheck entirely — and that exclusion was hiding real breakage:
// the factories here build complete domain objects, so every field added to a domain type left
// them silently stale until someone happened to look.
// The declarations live behind the package's `./types` export, not its root one.
/// <reference types="@cloudflare/vitest-pool-workers/types" />

export {};
