export interface Env {
  DB: D1Database;
  API_RATE_LIMIT: RateLimit;
  API_BURST_LIMIT: RateLimit;
  MAL_USER_AGENT?: string;
  PROFILE_TTL_SECONDS?: string;
  LIST_TTL_SECONDS?: string;
  ANIME_TTL_SECONDS?: string;
  CATALOG_TTL_SECONDS?: string;
  SOURCE_TIMEOUT_MS?: string;
  MAX_UPSTREAM_BYTES?: string;
  /** The `version_metadata` binding: which deployed version is answering. Absent in unit tests. */
  CF_VERSION_METADATA?: WorkerVersionMetadata;
}

/**
 * What `X-Worker-Version` carries: the platform's version id, or `local` where there is none.
 *
 * `||`, not `??`: `wrangler dev --remote` binds the metadata with an empty id (measured on
 * 2026-11-17: `{ id: '', tag: '', timestamp: '0001-01-01T00:00:00Z' }`), and an empty header says
 * less than `local`.
 */
export function workerVersion(env: Pick<Env, 'CF_VERSION_METADATA'> | undefined): string {
  return env?.CF_VERSION_METADATA?.id || 'local';
}

export interface RuntimeConfig {
  profileTtlSeconds: number;
  listTtlSeconds: number;
  animeTtlSeconds: number;
  catalogTtlSeconds: number;
  sourceTimeoutMs: number;
  maxUpstreamBytes: number;
  malUserAgent: string;
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function configFrom(env: Env): RuntimeConfig {
  return {
    profileTtlSeconds: numberEnv(env.PROFILE_TTL_SECONDS, 21_600),
    listTtlSeconds: numberEnv(env.LIST_TTL_SECONDS, 7_200),
    animeTtlSeconds: numberEnv(env.ANIME_TTL_SECONDS, 21_600),
    catalogTtlSeconds: numberEnv(env.CATALOG_TTL_SECONDS, 21_600),
    sourceTimeoutMs: numberEnv(env.SOURCE_TIMEOUT_MS, 8_000),
    maxUpstreamBytes: numberEnv(env.MAX_UPSTREAM_BYTES, 5 * 1024 * 1024),
    malUserAgent: env.MAL_USER_AGENT ?? 'jikan-edge/0.1',
  };
}
